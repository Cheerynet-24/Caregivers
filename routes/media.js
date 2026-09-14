const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { auth } = require('../middleware/auth');
const router = express.Router();
const execFileAsync = promisify(execFile);
const uploadDir = path.join(__dirname, '../uploads');

const isSafePublicUrl = value => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '::1' || host.endsWith('.local') || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch { return false; }
};

router.get('/music-search', auth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=25`);
    if (!response.ok) return res.status(502).json({ error: 'Music search unavailable' });
    const data = await response.json();
    res.json({ results: (data.results || []).map(item => ({
      id: item.trackId,
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName,
      artwork: item.artworkUrl100,
      previewUrl: item.previewUrl,
      storeUrl: item.trackViewUrl
    })) });
  } catch { res.status(502).json({ error: 'Music search failed' }); }
});

router.post('/download', auth, async (req, res) => {
  const sourceUrl = String(req.body?.url || '').trim();
  const requestedName = String(req.body?.name || 'caregivers-media').replace(/[^a-z0-9._-]/gi, '_').slice(0, 80) || 'caregivers-media';
  if (!isSafePublicUrl(sourceUrl)) return res.status(400).json({ error: 'Only safe public http(s) direct media links are supported' });
  const tempInput = path.join(os.tmpdir(), `caregivers-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const outputName = `${Date.now()}-${requestedName.replace(/\.[^.]+$/, '')}.mp3`;
  const outputPath = path.join(uploadDir, outputName);
  try {
    const response = await fetch(sourceUrl, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
    if (!response.ok || !response.body) return res.status(502).json({ error: 'Media link could not be downloaded' });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('audio/') && !contentType.startsWith('video/')) return res.status(415).json({ error: 'Link must point directly to an audio or video file' });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 150 * 1024 * 1024) return res.status(413).json({ error: 'File is larger than 150 MB' });
    await pipeline(response.body, fs.createWriteStream(tempInput));
    await execFileAsync('ffmpeg', ['-y', '-i', tempInput, '-vn', '-codec:a', 'libmp3lame', '-b:a', '192k', outputPath], { timeout: 180000 });
    res.json({ fileUrl: `/uploads/${outputName}`, fileName: outputName, type: 'audio' });
  } catch (error) {
    try { fs.unlinkSync(outputPath); } catch {}
    res.status(502).json({ error: error.name === 'TimeoutError' ? 'Download timed out' : 'Media conversion failed' });
  } finally { try { fs.unlinkSync(tempInput); } catch {} }
});

module.exports = router;
