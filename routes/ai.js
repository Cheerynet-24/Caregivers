const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const SYSTEM_PROMPT = 'You are Caregivers AI, a friendly and safe assistant. Always answer in the same language as the latest user message: Burmese only for Burmese messages, English only for English messages, and never mix languages unless the user asks for translation. Be direct and concise: for greetings reply with a short greeting; normally answer in 1-4 short sentences or a few clear bullets. Use the full conversation history to keep context and do not repeat the user\'s question. Do not claim to be human, request passwords or private secrets, or replace qualified medical, legal, or financial professionals.';

async function callGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const requestedModel = process.env.GEMINI_MODEL;
  let models = requestedModel ? [requestedModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'] : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  try {
    const modelListResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (modelListResponse.ok && !requestedModel) {
      const modelList = await modelListResponse.json();
      const available = (modelList.models || []).filter(item => (item.supportedGenerationMethods || []).includes('generateContent')).filter(item => !/(tts|audio|image|embedding|robotics)/i.test(item.name || '')).map(item => String(item.name || '').replace(/^models\//, ''));
      const preferred = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      models = [...preferred.filter(model => available.includes(model)), ...available.filter(model => !preferred.includes(model))];
    }
  } catch (error) { console.warn('Gemini model discovery failed:', error.message); }
  const contents = messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
  let lastError = null;
  for (const model of models) {
    const configs = model.includes('2.5') ? [{ maxOutputTokens: 700 }, { maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 128 } }] : [{ maxOutputTokens: 700 }];
    for (const generationConfig of configs) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig }) });
      const data = await response.json();
      if (response.ok) {
        const content = data?.candidates?.[0]?.content?.parts?.filter(part => !part.thought && part.text).map(part => part.text).join('').trim();
        if (content) return content;
        lastError = { status: 502, message: 'Gemini returned no visible text' };
        continue;
      }
      lastError = { status: response.status, message: data?.error?.message || '' };
      console.error('Gemini provider error:', model, response.status, lastError.message);
      if ([401, 403, 429].includes(response.status)) break;
    }
    if ([401, 403, 429].includes(lastError?.status)) break;
  }
  if (lastError?.status === 401) throw new Error('Gemini API key မမှန်ပါ သို့မဟုတ် API key ပြတ်တောက်နေပါတယ်');
  if (lastError?.status === 403) throw new Error('Gemini API permission မရသေးပါ။ Generative Language API နဲ့ key restriction ကို စစ်ပါ');
  if (lastError?.status === 400) throw new Error(`Gemini request မမှန်ပါ: ${lastError.message || 'model setting ကို စစ်ပါ'}`);
  if (lastError?.status === 429) throw new Error('Gemini free quota/rate limit ပြည့်နေပါတယ်');
  throw new Error(`Gemini model မတွေ့ပါ (နောက်ဆုံး error ${lastError?.status || 'unknown'})`);
}

async function callOpenAI(messages) {
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  if (!process.env.OPENAI_API_KEY) throw new Error('AI provider မသတ်မှတ်ရသေးပါ။ GEMINI_API_KEY သို့မဟုတ် OPENAI_API_KEY ထည့်ပါ');
  const requestBody = model => ({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages], max_completion_tokens: 700 });
  const request = model => fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody(model)) });
  let response = await request(process.env.AI_MODEL || 'gpt-5-mini');
  let data = await response.json();
  if (!response.ok && !process.env.AI_MODEL && [400, 404].includes(response.status)) { response = await request('gpt-4o-mini'); data = await response.json(); }
  if (!response.ok) { if (response.status === 429) throw new Error('OpenAI quota သို့မဟုတ် billing limit ပြည့်နေပါတယ်'); throw new Error(`OpenAI service error (${response.status})`); }
  return data?.choices?.[0]?.message?.content?.trim();
}

async function generateReply(messages) {
  const content = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? await callGemini(messages) : await callOpenAI(messages);
  if (!content) throw new Error('AI returned an empty response');
  return content;
}

router.get('/conversations', auth, async (req, res) => {
  const conversations = await prisma.aiConversation.findMany({ where: { userId: req.user.id }, orderBy: { updatedAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } });
  res.json({ conversations: conversations.map(item => ({ id: item.id, title: item.title, createdAt: item.createdAt, updatedAt: item.updatedAt, lastMessage: item.messages[0] || null })) });
});

router.post('/conversations', auth, async (req, res) => {
  const conversation = await prisma.aiConversation.create({ data: { userId: req.user.id, title: String(req.body.title || 'New chat').slice(0, 80) } });
  res.status(201).json({ conversation: { ...conversation, messages: [] } });
});

router.get('/conversations/:id', auth, async (req, res) => {
  const conversation = await prisma.aiConversation.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } } });
  if (!conversation) return res.status(404).json({ error: 'AI conversation not found' });
  res.json({ conversation });
});

router.delete('/conversations/:id', auth, async (req, res) => {
  await prisma.aiConversation.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ success: true });
});

router.post('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Message is required' });
    const conversation = await prisma.aiConversation.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } } });
    if (!conversation) return res.status(404).json({ error: 'AI conversation not found' });
    const userMessage = await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'user', content: content.slice(0, 4000) } });
    const history = [...conversation.messages, userMessage].slice(-50).map(message => ({ role: message.role, content: message.content }));
    const assistantMessage = await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: await generateReply(history) } });
    if (conversation.title === 'New chat') await prisma.aiConversation.update({ where: { id: conversation.id }, data: { title: content.slice(0, 80) } });
    res.json({ messages: [userMessage, assistantMessage] });
  } catch (error) { console.error('AI conversation error:', error); res.status(502).json({ error: error.message || 'Failed to contact AI' }); }
});

// Backward-compatible one-shot endpoint.
router.post('/chat', auth, async (req, res) => {
  try {
    const messages = (Array.isArray(req.body.messages) ? req.body.messages : []).filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string').slice(-50).map(message => ({ role: message.role, content: message.content.slice(0, 3000) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'A user message is required' });
    res.json({ message: { role: 'assistant', content: await generateReply(messages) } });
  } catch (error) { console.error('AI chat error:', error); res.status(502).json({ error: error.message || 'Failed to contact AI' }); }
});

module.exports = router;
