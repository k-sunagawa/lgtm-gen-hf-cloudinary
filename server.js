import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env を server.js と同じディレクトリから読み込む（cwd に依存しない）
dotenv.config({ path: path.join(__dirname, '.env') });

const ROUTER_URL = 'https://router.huggingface.co';

const app = express();
const PORT = process.env.PORT || 3000;
const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGING_FACE_TOKEN || null;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || null;
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || null;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || null;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || null;

app.use(express.json({ limit: '10mb' }));

app.get('/api/config', (req, res) => {
  res.json({
    useServerToken: !!HF_TOKEN,
    hasUpload: !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET),
    hasCloudinaryAdmin: !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET),
  });
});

/**
 * hf-inference プロバイダー経由でテキストから画像を生成（無料枠）
 */
app.post('/api/inference', async (req, res) => {
  const { model, prompt, width, height, token: bodyToken } = req.body;
  const effectiveToken = HF_TOKEN || (bodyToken && bodyToken.trim()) || null;
  if (!effectiveToken) {
    return res.status(400).json({
      error: 'HF_TOKEN not set and no token in request. Set .env HF_TOKEN or enter token in the form.',
    });
  }
  if (!model || !prompt) {
    return res.status(400).json({ error: 'model and prompt required' });
  }

  try {
    const w = width || 1024;
    const h = height || 1024;

    const url = `${ROUTER_URL}/hf-inference/models/${model}`;
    const postRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt, parameters: { width: w, height: h } }),
    });

    if (!postRes.ok) {
      const raw = await postRes.text();
      let errMsg = raw || postRes.statusText;
      try {
        const j = JSON.parse(raw);
        if (typeof j.error === 'string') errMsg = j.error;
      } catch (_) {}
      console.error('[api/inference]', postRes.status, errMsg);
      return res.status(postRes.status).json({ error: errMsg });
    }

    const buf = Buffer.from(await postRes.arrayBuffer());
    res.setHeader('Content-Type', postRes.headers.get('Content-Type') || 'image/jpeg');
    res.send(buf);
  } catch (e) {
    console.error('[api/inference]', e);
    const message = (e && typeof e === 'object' && 'message' in e && e.message) || 'Upstream error';
    res.status(502).json({ error: String(message) });
  }
});

/**
 * Cloudinary に画像をアップロードして公開 URL を返す
 */
app.post('/api/upload', async (req, res) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    return res.status(400).json({ error: 'Cloudinary env vars not set.' });
  }
  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image (base64) required' });
  }

  try {
    const body = new URLSearchParams({
      file: `data:image/png;base64,${image}`,
      upload_preset: CLOUDINARY_UPLOAD_PRESET,
    });
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body }
    );
    const data = await cloudRes.json();
    if (!cloudRes.ok || !data.secure_url) {
      const errMsg = data.error?.message || 'Cloudinary upload failed';
      console.error('[api/upload]', errMsg);
      return res.status(502).json({ error: errMsg });
    }
    res.json({ url: data.secure_url });
  } catch (e) {
    console.error('[api/upload]', e);
    const message = (e && typeof e === 'object' && 'message' in e && e.message) || 'Upload error';
    res.status(502).json({ error: String(message) });
  }
});

/**
 * Cloudinary Admin API で画像一覧を取得（他環境でアップロードした画像も含む）
 */
app.get('/api/cloudinary-images', async (req, res) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(400).json({ error: 'Cloudinary Admin API not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.' });
  }
  const { next_cursor: nextCursor } = req.query;
  try {
    const params = new URLSearchParams({ max_results: '100', type: 'upload' });
    if (typeof nextCursor === 'string' && nextCursor) params.set('next_cursor', nextCursor);
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image/upload?${params}`;
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
    const cloudRes = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const data = await cloudRes.json();
    if (!cloudRes.ok) {
      const errMsg = data.error?.message || 'Cloudinary Admin API failed';
      console.error('[api/cloudinary-images]', errMsg);
      return res.status(502).json({ error: errMsg });
    }
    const resources = (data.resources || []).map((r) => ({
      secure_url: r.secure_url,
      public_id: r.public_id,
      created_at: r.created_at,
    }));
    res.json({ resources, next_cursor: data.next_cursor || null });
  } catch (e) {
    console.error('[api/cloudinary-images]', e);
    const message = (e && typeof e === 'object' && 'message' in e && e.message) || 'Cloudinary fetch error';
    res.status(502).json({ error: String(message) });
  }
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`LGTM Generator: http://localhost:${PORT}`);
  if (HF_TOKEN) console.log('HF_TOKEN from env: using server proxy');
  else console.log('HF_TOKEN not set: enter token in the form');
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
    console.log('Cloudinary configured: upload enabled');
  } else {
    console.log('Cloudinary not set: add CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET to .env for favorites');
  }
  if (CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    console.log('Cloudinary Admin API: Cloudinary tab enabled in gallery');
  }
});
