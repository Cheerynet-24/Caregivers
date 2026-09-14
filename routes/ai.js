const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/chat', auth, async (req, res) => {
  try {
    const input = Array.isArray(req.body.messages) ? req.body.messages : [];
    const messages = input
      .filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string')
      .slice(-20)
      .map(message => ({ role: message.role, content: message.content.slice(0, 4000) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'A user message is required' });
    const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI service is not configured yet' });

    const response = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'You are Caregivers AI, a friendly and safe assistant. Reply in the user\'s language when possible, including Burmese. Do not claim to be a human, do not request passwords or private secrets, and recommend contacting a qualified professional for medical, legal, or financial decisions.' },
          ...messages
        ],
        max_completion_tokens: 700
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('AI provider error:', response.status, data?.error?.message || data);
      return res.status(502).json({ error: 'AI service is temporarily unavailable' });
    }
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return res.status(502).json({ error: 'AI returned an empty response' });
    res.json({ message: { role: 'assistant', content } });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to contact AI' });
  }
});

module.exports = router;
