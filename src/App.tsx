import { useCallback, useEffect, useRef, useState } from 'react';
import Gallery from './Gallery';
import { saveImage } from './imageStore';

const MODELS = [
  { value: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1-schnell（高速）' },
  { value: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL Base' },
  { value: 'runwayml/stable-diffusion-v1-5', label: 'SD v1.5（軽量）' },
] as const;

const SIZES = [
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1280x720', label: '1280 × 720（横）' },
  { value: '720x1280', label: '720 × 1280（縦）' },
  { value: '512x512', label: '512 × 512（軽量）' },
  { value: '320x320', label: '320 × 320（超軽量）' },
] as const;

const SHADOWS = [
  { value: 'hard', label: 'Hard（黒縁）' },
  { value: 'glow', label: 'Glow' },
  { value: 'none', label: 'None' },
] as const;

const POSITIONS = [
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
] as const;

const HF_TOKEN_STORAGE_KEY = 'lgtm-gen-hf-token';
const SUBTITLE_STORAGE_KEY = 'lgtm-gen-subtitle';

interface ApiConfig {
  useServerToken: boolean;
  hasUpload: boolean;
  hasCloudinaryAdmin?: boolean;
}

function getStoredToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(HF_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function getStoredSubtitle(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(SUBTITLE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function App() {
  const [useServerToken, setUseServerToken] = useState(false);
  const [hasUpload, setHasUpload] = useState(false);
  const [hasCloudinaryAdmin, setHasCloudinaryAdmin] = useState(false);
  const [token, setToken] = useState(getStoredToken);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string>(MODELS[0].value);
  const [size, setSize] = useState('320x320');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(25);
  const [shadowStyle, setShadowStyle] = useState<'hard' | 'glow' | 'none'>('hard');
  const [position, setPosition] = useState<'center' | 'top' | 'bottom'>('center');
  const [subtitle, setSubtitle] = useState(getStoredSubtitle);
  const [lastImg, setLastImg] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<'generator' | 'gallery'>('generator');
  const [favoriteStatus, setFavoriteStatus] = useState<{ type: 'error' | 'success' | 'loading'; msg: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json() as Promise<ApiConfig>)
      .then((c) => {
        setUseServerToken(c.useServerToken);
        setHasUpload(c.hasUpload);
        setHasCloudinaryAdmin(!!c.hasCloudinaryAdmin);
      })
      .catch(() => {
        setUseServerToken(false);
        setHasUpload(false);
        setHasCloudinaryAdmin(false);
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (token) localStorage.setItem(HF_TOKEN_STORAGE_KEY, token);
      else localStorage.removeItem(HF_TOKEN_STORAGE_KEY);
    } catch (_) {}
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (subtitle) localStorage.setItem(SUBTITLE_STORAGE_KEY, subtitle);
      else localStorage.removeItem(SUBTITLE_STORAGE_KEY);
    } catch (_) {}
  }, [subtitle]);

  const renderLGTM = useCallback(
    (img: HTMLImageElement) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const fontSize = Math.floor(img.naturalWidth * (textSize / 100));
      ctx.font = `bold ${fontSize}px 'Black Han Sans', 'Arial Black', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const x = img.naturalWidth / 2;
      const y =
        position === 'top'
          ? img.naturalHeight * 0.18
          : position === 'bottom'
            ? img.naturalHeight * 0.82
            : img.naturalHeight / 2;

      if (shadowStyle === 'hard') {
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.lineWidth = fontSize * 0.08;
        ctx.strokeText('LGTM', x, y);
      } else if (shadowStyle === 'glow') {
        ctx.shadowColor = textColor;
        ctx.shadowBlur = fontSize * 0.3;
      }

      ctx.fillStyle = textColor;
      ctx.fillText('LGTM', x, y);
      ctx.shadowBlur = 0;

      if (subtitle.trim()) {
        const subFontSize = Math.floor(fontSize * 0.32);
        ctx.font = `bold ${subFontSize}px 'Black Han Sans', 'Arial Black', sans-serif`;
        const subY = y + fontSize * 0.62;
        if (shadowStyle === 'hard') {
          ctx.strokeStyle = 'rgba(0,0,0,0.95)';
          ctx.lineWidth = subFontSize * 0.08;
          ctx.strokeText(subtitle, x, subY);
        } else if (shadowStyle === 'glow') {
          ctx.shadowColor = textColor;
          ctx.shadowBlur = subFontSize * 0.3;
        }
        ctx.fillStyle = textColor;
        ctx.fillText(subtitle, x, subY);
        ctx.shadowBlur = 0;
      }

      resultAreaRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
    [textSize, textColor, shadowStyle, position, subtitle]
  );

  useEffect(() => {
    if (lastImg) renderLGTM(lastImg);
  }, [lastImg, renderLGTM]);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      const [targetW, targetH] = size.split('x').map(Number);
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        // 高さ基準でスケール、幅は中央クロップ or 黒埋め
        const scale = targetH / img.naturalHeight;
        const scaledW = Math.round(img.naturalWidth * scale);
        const offscreen = document.createElement('canvas');
        offscreen.width = targetW;
        offscreen.height = targetH;
        const ctx = offscreen.getContext('2d')!;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetW, targetH);
        const drawX = Math.round((targetW - scaledW) / 2);
        ctx.drawImage(img, drawX, 0, scaledW, targetH);
        const resized = new Image();
        resized.onload = () => setLastImg(resized);
        resized.src = offscreen.toDataURL('image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setStatus({ type: 'error', msg: '画像の読み込みに失敗しました' });
      };
      img.src = objectUrl;
    },
    [size]
  );

  const generate = async () => {
    if (!useServerToken && !token.trim()) {
      setStatus({ type: 'error', msg: 'Hugging Face Tokenを入力してください' });
      return;
    }
    if (!prompt.trim()) {
      setStatus({ type: 'error', msg: 'Promptを入力してください' });
      return;
    }

    const [w, h] = size.split('x').map(Number);
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          width: w,
          height: h,
          ...(useServerToken ? {} : { token: token.trim() }),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = err.error ?? res.statusText;
        if (res.status === 503) {
          throw new Error(`モデル読み込み中 (503)。20〜30秒後に再試行してください。\n${msg}`);
        }
        if (res.status === 500) {
          throw new Error(`Hugging Face 側のエラー (500)。しばらく待って再試行するか、別のモデルを選んでください。\n${msg}`);
        }
        throw new Error(`API Error ${res.status}: ${msg}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
        img.src = objectUrl;
      });

      setLastImg(img);
      URL.revokeObjectURL(objectUrl);
      setStatus({ type: 'success', msg: '✓ 生成成功！' });
    } catch (err) {
      const e = err as Error;
      let msg = e.message;
      if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
        msg = 'サーバーへの接続に失敗しました。ターミナルで「npm run dev」が実行中か確認し、http://localhost:5173 で開き直してください。';
      }
      setStatus({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `lgtm-${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const copyMarkdown = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    try {
      await navigator.clipboard.writeText(`![LGTM](${dataUrl})`);
      setCopyStatus({ type: 'success', msg: '✓ Markdown（base64）をコピーしました' });
      setTimeout(() => setCopyStatus(null), 4000);
    } catch {
      setCopyStatus({ type: 'error', msg: 'コピー失敗' });
      setTimeout(() => setCopyStatus(null), 4000);
    }
  };

  const addToFavorites = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasUpload) {
      setFavoriteStatus({ type: 'error', msg: 'Cloudinary が未設定です。.env に CLOUDINARY_CLOUD_NAME と CLOUDINARY_UPLOAD_PRESET を追加してください。' });
      setTimeout(() => setFavoriteStatus(null), 5000);
      return;
    }
    setFavoriteStatus({ type: 'loading', msg: '⏳ Cloudinary にアップロード中...' });
    try {
      const base64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? res.statusText);
      }
      const { url } = (await res.json()) as { url: string };
      const dataUrl = canvas.toDataURL('image/png');
      await saveImage({ dataUrl, prompt, model, timestamp: Date.now(), cloudinaryUrl: url });
      setFavoriteStatus({ type: 'success', msg: '⭐ お気に入りに追加しました' });
    } catch (err) {
      const e = err as Error;
      setFavoriteStatus({ type: 'error', msg: `アップロード失敗: ${e.message}` });
    }
    setTimeout(() => setFavoriteStatus(null), 4000);
  };

  return (
    <>
      <header>
        <div className="logo">LGTM</div>
        <p className="subtitle">Looks Good To Me · Generator</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="badge">🤗 Hugging Face · Stable Diffusion · 無料</span>
          <button
            type="button"
            className="actionBtn btnCopy"
            style={{ fontSize: '0.8rem', padding: '4px 14px' }}
            onClick={() => setPage(page === 'gallery' ? 'generator' : 'gallery')}
          >
            {page === 'gallery' ? '← Generator' : '⭐ お気に入り'}
          </button>
        </div>
      </header>

      {page === 'gallery' ? (
        <Gallery onBack={() => setPage('generator')} hasCloudinaryAdmin={hasCloudinaryAdmin} />
      ) : null}

      <div className="card" style={{ display: page === 'generator' ? undefined : 'none' }}>
        <div className="field">
          <label className="label">Hugging Face Token</label>
          <input
            type="password"
            className="input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="hf_..."
            autoComplete="off"
          />
          <p className="hint">
            <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">
              huggingface.co/settings/tokens
            </a>
            で無料取得（Read権限のみでOK）
          </p>
        </div>

        <div className="field">
          <label className="label">Image Prompt</label>
          <textarea
            className="textarea"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={'例: a cute shiba inu sitting in a meadow, watercolor style\n※英語推奨'}
          />
        </div>

        <div className="row">
          <div className="field">
            <label className="label">Model</label>
            <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Size</label>
            <select className="select" value={size} onChange={(e) => setSize(e.target.value)}>
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border, #333)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--muted, #888)' }}>または</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border, #333)' }} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label">既存画像をアップロードして LGTM を追加</label>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          <button
            type="button"
            className="actionBtn btnDownload"
            style={{ fontSize: '0.85rem' }}
            onClick={() => fileInputRef.current?.click()}
          >
            📎 画像を選択
          </button>
          <p className="hint" style={{ marginTop: 4 }}>選択中の Size（{size}）に合わせてリサイズします</p>
        </div>

        <hr className="divider" />

        <div className="field">
          <label className="label">LGTM テキストスタイル</label>
          <div className="colorRow">
            <label className="label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              Color
            </label>
            <input
              type="color"
              className="inputColor"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
            />
            <label className="label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              Size
            </label>
            <input
              type="range"
              className="inputRange"
              min={10}
              max={80}
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', width: 36 }}>{textSize}%</span>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label className="label">Subtitle（LGTM の下に表示）</label>
            <input
              type="text"
              className="input"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="例: Sunagawa（空欄で非表示）"
            />
          </div>
          <div className="row" style={{ marginBottom: 0 }}>
            <div className="field">
              <label className="label">Shadow</label>
              <select
                className="select"
                value={shadowStyle}
                onChange={(e) => setShadowStyle(e.target.value as 'hard' | 'glow' | 'none')}
              >
                {SHADOWS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Position</label>
              <select
                className="select"
                value={position}
                onChange={(e) => setPosition(e.target.value as 'center' | 'top' | 'bottom')}
              >
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`generateBtn ${loading ? 'loading' : ''}`}
          onClick={generate}
          disabled={loading}
        >
          {loading ? '⏳ Generating... (20〜60秒かかります)' : '▶ Generate'}
        </button>
        {status && <div className={`status ${status.type}`}>{status.msg}</div>}
      </div>

      <div className="resultArea" ref={resultAreaRef} style={{ display: lastImg && page === 'generator' ? 'block' : 'none' }}>
        <p className="resultLabel">Result</p>
        <canvas ref={canvasRef} className="canvas" />
        <div className="actionRow">
          <button type="button" className="actionBtn btnDownload" onClick={download}>
            ↓ Download PNG
          </button>
          <button type="button" className="actionBtn btnCopy" onClick={copyMarkdown}>
            ⎘ Copy Markdown
          </button>
          <button
            type="button"
            className="actionBtn"
            style={{ background: '#f39c12', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={addToFavorites}
            disabled={favoriteStatus?.type === 'loading'}
          >
            ⭐ お気に入り
          </button>
        </div>
        {copyStatus && <div className={`status ${copyStatus.type}`} style={{ marginTop: 8 }}>{copyStatus.msg}</div>}
        {favoriteStatus && <div className={`status ${favoriteStatus.type === 'loading' ? 'success' : favoriteStatus.type}`} style={{ marginTop: 8 }}>{favoriteStatus.msg}</div>}
      </div>
    </>
  );
}
