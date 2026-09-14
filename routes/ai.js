const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();
const SYSTEM_PROMPT = 'You are Caregivers AI, a friendly and safe assistant. Reply in the user\'s language when possible, including Burmese. Do not claim to be a human, do not request passwords or private secrets, and recommend contacting a qualified professional for medical, legal, or financial decisions.';

async function callGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const requestedModel = process.env.GEMINI_MODEL;
  let models = requestedModel ? [requestedModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'] : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  try {
    const modelListResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (modelListResponse.ok && !requestedModel) {
      const modelList = await modelListResponse.json();
      const available = (modelList.models || [])
        .filter(item => (item.supportedGenerationMethods || []).includes('generateContent'))
        .map(item => String(item.name || '').replace(/^models\//, ''));
      const preferred = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      models = [...preferred.filter(model => available.includes(model)), ...available.filter(model => !preferred.includes(model))];
    }
  } catch (error) { console.warn('Gemini model discovery failed:', error.message); }
  const contents = messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
  let lastError = null;
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig: { maxOutputTokens: 700 } })
    });
    const data = await response.json();
    if (response.ok) return data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    lastError = { status: response.status, message: data?.error?.message || '' };
    console.error('Gemini provider error:', model, response.status, lastError.message);
    if ([400, 401, 403, 429].includes(response.status)) break;
  }
  if (lastError?.status === 401) throw new Error('Gemini API key မမှန်ပါ သို့မဟုတ် API key ပြတ်တောက်နေပါတယ်။ GEMINI_API_KEY ကို ပြန်စစ်ပါ');
  if (lastError?.status === 403) throw new Error('Gemini API ကို ဒီ key/project အတွက် ခွင့်မပြုသေးပါ။ Google AI Studio/Google Cloud မှာ Generative Language API ကို Enable လုပ်ပြီး key restriction ကို စစ်ပါ');
  if (lastError?.status === 400) throw new Error(`Gemini request မမှန်ပါ: ${lastError.message || 'GEMINI_MODEL ကို ဖျက်ပြီး auto model ရွေးခိုင်းပါ'}`);
  if (lastError?.status === 429) throw new Error('Gemini free quota/rate limit ပြည့်နေပါတယ်');
  throw new Error(`Gemini model မတွေ့ပါ။ GEMINI_MODEL ကို မသတ်မှတ်ဘဲ ပြန်စမ်းပါ (နောက်ဆုံး error ${lastError?.status || 'unknown'})`);
}

async function callOpenAI(messages) {
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  if (!process.env.OPENAI_API_KEY) throw new Error('AI provider မသတ်မှတ်ရသေးပါ။ GEMINI_API_KEY သို့မဟုတ် OPENAI_API_KEY ထည့်ပါ');
  const requestBody = model => ({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages], max_completion_tokens: 700 });
  const request = model => fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody(model)) });
  let response = await request(process.env.AI_MODEL || 'gpt-5-mini');
  let data = await response.json();
  if (!response.ok && !process.env.AI_MODEL && [400, 404].includes(response.status)) { response = await request('gpt-4o-mini'); data = await response.json(); }
  if (!response.ok) {
    console.error('OpenAI provider error:', response.status, data?.error?.message || data);
    if (response.status === 401 || response.status === 403) throw new Error('OpenAI API key မမှန်ပါ');
    if (response.status === 429) throw new Error('OpenAI quota သို့မဟုတ် billing limit ပြည့်နေပါတယ်');
    throw new Error(`OpenAI service error (${response.status})`);
  }
  return data?.choices?.[0]?.message?.content?.trim();
}

router.post('/chat', auth, async (req, res) => {
  try {
    const input = Array.isArray(req.body.messages) ? req.body.messages : [];
    const messages = input.filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string').slice(-20).map(message => ({ role: message.role, content: message.content.slice(0, 4000) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'A user message is required' });

    const content = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? await callGemini(messages) : await callOpenAI(messages);
    if (!content) return res.status(502).json({ error: 'AI returned an empty response' });
    res.json({ message: { role: 'assistant', content } });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(502).json({ error: error.message || 'Failed to contact AI' });
  }
});

module.exports = router;
