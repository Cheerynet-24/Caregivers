const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();
const SYSTEM_PROMPT = 'You are Caregivers AI, a friendly and safe assistant. Reply in the user\'s language when possible, including Burmese. Do not claim to be a human, do not request passwords or private secrets, and recommend contacting a qualified professional for medical, legal, or financial decisions.';

async function callGemini(messages) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents = messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig: { maxOutputTokens: 700 } })
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('Gemini provider error:', response.status, data?.error?.message || data);
    if (response.status === 400 || response.status === 401 || response.status === 403) throw new Error('Gemini API key သို့မဟုတ် model မမှန်ပါ');
    if (response.status === 429) throw new Error('Gemini free quota/rate limit ပြည့်နေပါတယ်');
    throw new Error(`Gemini service error (${response.status})`);
  }
  return data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
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

    const content = process.env.GEMINI_API_KEY ? await callGemini(messages) : await callOpenAI(messages);
    if (!content) return res.status(502).json({ error: 'AI returned an empty response' });
    res.json({ message: { role: 'assistant', content } });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(502).json({ error: error.message || 'Failed to contact AI' });
  }
});

module.exports = router;
