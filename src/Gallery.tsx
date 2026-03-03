import { useEffect, useRef, useState } from 'react';
import { deleteImage, getAllImages, StoredImage } from './imageStore';

interface Props {
  onBack: () => void;
}

export default function Gallery({ onBack }: Props) {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [expanded, setExpanded] = useState<StoredImage | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAllImages().then(setImages).catch(console.error);
  }, []);

  const handleDelete = async (id: number) => {
    await deleteImage(id).catch(console.error);
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (expanded?.id === id) setExpanded(null);
  };

  const copy = async (img: StoredImage) => {
    if (!img.cloudinaryUrl) return;
    await navigator.clipboard.writeText(`![LGTM](${img.cloudinaryUrl})`).catch(() => {});
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopyMsg('✓ Markdown をコピーしました');
    copyTimerRef.current = setTimeout(() => setCopyMsg(null), 3000);
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" className="actionBtn btnDownload" onClick={onBack} style={{ padding: '6px 14px' }}>
          ← Generator
        </button>
        <span style={{ fontWeight: 600 }}>⭐ お気に入り ({images.length})</span>
        {copyMsg && <span style={{ color: '#27ae60', fontSize: '0.8rem' }}>{copyMsg}</span>}
      </div>

      {images.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          まだ登録されていません。Generator で画像を生成し、⭐ お気に入りボタンで保存してください。
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {images.map((img) => (
            <div key={img.id} className="card" style={{ padding: 8 }}>
              <img
                src={img.dataUrl}
                alt="LGTM"
                style={{ width: '100%', borderRadius: 4, display: 'block', cursor: 'pointer' }}
                onClick={() => setExpanded(img)}
              />
              <p style={{ fontSize: '0.68rem', color: 'var(--muted)', margin: '6px 0 2px 0' }}>
                {fmt(img.timestamp)}
              </p>
              <p
                style={{
                  fontSize: '0.68rem',
                  margin: '0 0 8px 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={img.prompt}
              >
                {img.prompt || '—'}
              </p>
              {img.cloudinaryUrl && (
                <p style={{ fontSize: '0.6rem', color: 'var(--muted)', margin: '0 0 6px 0' }}>☁ Cloudinary</p>
              )}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="actionBtn btnCopy"
                  style={{ flex: 1, fontSize: '0.65rem', padding: '4px 0' }}
                  onClick={() => copy(img)}
                >
                  ⎘ Copy
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    fontSize: '0.65rem',
                    padding: '4px 0',
                    background: '#c0392b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => img.id !== undefined && handleDelete(img.id)}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {expanded && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setExpanded(null)}
        >
          <img
            src={expanded.dataUrl}
            alt="LGTM"
            style={{ maxWidth: '90vw', maxHeight: '75vh', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="actionBtn btnCopy" onClick={() => copy(expanded)}>
              ⎘ Copy Markdown
            </button>
            <button type="button" className="actionBtn btnDownload" onClick={() => setExpanded(null)}>
              閉じる
            </button>
            <button
              type="button"
              style={{
                background: '#c0392b',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
              onClick={() => expanded.id !== undefined && handleDelete(expanded.id)}
            >
              削除
            </button>
          </div>
          {expanded.prompt && (
            <p style={{ color: '#aaa', fontSize: '0.75rem', marginTop: 10, maxWidth: 400, textAlign: 'center' }}>
              {expanded.prompt}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
