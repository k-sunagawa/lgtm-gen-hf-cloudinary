import { useEffect, useRef, useState } from 'react';
import { deleteImage, getAllImages, StoredImage } from './imageStore';

interface CloudinaryImage {
  secure_url: string;
  public_id: string;
  created_at: string;
}

type DisplayImage = (StoredImage & { source: 'local' }) | (CloudinaryImage & { source: 'cloudinary' });

interface Props {
  onBack: () => void;
  hasCloudinaryAdmin?: boolean;
}

export default function Gallery({ onBack, hasCloudinaryAdmin }: Props) {
  const [localImages, setLocalImages] = useState<StoredImage[]>([]);
  const [cloudinaryImages, setCloudinaryImages] = useState<CloudinaryImage[]>([]);
  const [viewMode, setViewMode] = useState<'local' | 'cloudinary'>('local');
  const [cloudinaryLoading, setCloudinaryLoading] = useState(false);
  const [cloudinaryError, setCloudinaryError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<DisplayImage | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAllImages().then(setLocalImages).catch(console.error);
  }, []);

  const fetchCloudinaryImages = async (nextCursor?: string) => {
    if (!hasCloudinaryAdmin) return;
    setCloudinaryLoading(true);
    setCloudinaryError(null);
    try {
      const params = nextCursor ? `?next_cursor=${encodeURIComponent(nextCursor)}` : '';
      const res = await fetch(`/api/cloudinary-images${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setCloudinaryImages((prev) => (nextCursor ? [...prev, ...data.resources] : data.resources));
    } catch (err) {
      setCloudinaryError((err as Error).message);
    } finally {
      setCloudinaryLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteImage(id).catch(console.error);
    setLocalImages((prev) => prev.filter((img) => img.id !== id));
    if (expanded && expanded.source === 'local' && expanded.id === id) setExpanded(null);
  };

  const getDisplayUrl = (img: DisplayImage) =>
    img.source === 'local' ? (img.cloudinaryUrl || img.dataUrl) : img.secure_url;

  const copy = async (img: DisplayImage) => {
    const url = img.source === 'local' ? img.cloudinaryUrl : img.secure_url;
    if (!url) return;
    await navigator.clipboard.writeText(`![LGTM](${url})`).catch(() => {});
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

  const fmtCloudinary = (createdAt: string) =>
    new Date(createdAt).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const images: DisplayImage[] =
    viewMode === 'local'
      ? localImages.map((img) => ({ ...img, source: 'local' as const }))
      : cloudinaryImages.map((img) => ({ ...img, source: 'cloudinary' as const }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button type="button" className="actionBtn btnDownload" onClick={onBack} style={{ padding: '6px 14px' }}>
          ← Generator
        </button>
        {hasCloudinaryAdmin && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="actionBtn"
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                background: viewMode === 'local' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'local' ? '#fff' : 'inherit',
              }}
              onClick={() => setViewMode('local')}
            >
              ローカル ({localImages.length})
            </button>
            <button
              type="button"
              className="actionBtn"
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                background: viewMode === 'cloudinary' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'cloudinary' ? '#fff' : 'inherit',
              }}
              onClick={() => {
                setViewMode('cloudinary');
                if (cloudinaryImages.length === 0 && !cloudinaryLoading) fetchCloudinaryImages();
              }}
            >
              ☁ Cloudinary
            </button>
          </div>
        )}
        {viewMode === 'cloudinary' && cloudinaryImages.length === 0 && !cloudinaryLoading && (
          <button
            type="button"
            className="actionBtn btnCopy"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => fetchCloudinaryImages()}
          >
            読み込む
          </button>
        )}
        {copyMsg && <span style={{ color: '#27ae60', fontSize: '0.8rem' }}>{copyMsg}</span>}
      </div>

      {viewMode === 'cloudinary' && cloudinaryLoading && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>Cloudinary から読み込み中...</p>
      )}

      {viewMode === 'cloudinary' && cloudinaryError && (
        <p style={{ color: '#e74c3c', textAlign: 'center', padding: '20px 0' }}>{cloudinaryError}</p>
      )}

      {viewMode === 'local' && localImages.length === 0 && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          まだ登録されていません。Generator で画像を生成し、⭐ お気に入りボタンで保存してください。
        </p>
      )}

      {viewMode === 'cloudinary' && !cloudinaryLoading && cloudinaryImages.length === 0 && !cloudinaryError && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          「読み込む」をクリックして、Cloudinary にアップロードされた画像を表示します。
        </p>
      )}

      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {images.map((img) => (
            <div
              key={img.source === 'local' ? img.id : img.public_id}
              className="card"
              style={{ padding: 8 }}
            >
              <img
                src={getDisplayUrl(img)}
                alt="LGTM"
                style={{ width: '100%', borderRadius: 4, display: 'block', cursor: 'pointer' }}
                onClick={() => setExpanded(img)}
              />
              <p style={{ fontSize: '0.68rem', color: 'var(--muted)', margin: '6px 0 2px 0' }}>
                {img.source === 'local' ? fmt(img.timestamp) : fmtCloudinary(img.created_at)}
              </p>
              <p
                style={{
                  fontSize: '0.68rem',
                  margin: '0 0 8px 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={img.source === 'local' ? img.prompt : img.public_id}
              >
                {img.source === 'local' ? (img.prompt || '—') : img.public_id}
              </p>
              {img.source === 'cloudinary' && (
                <p style={{ fontSize: '0.6rem', color: 'var(--muted)', margin: '0 0 6px 0' }}>☁ Cloudinary</p>
              )}
              {img.source === 'local' && img.cloudinaryUrl && (
                <p style={{ fontSize: '0.6rem', color: 'var(--muted)', margin: '0 0 6px 0' }}>☁ Cloudinary</p>
              )}
              <div style={{ display: 'flex', gap: 4 }}>
                {(img.source === 'cloudinary' || (img.source === 'local' && img.cloudinaryUrl)) && (
                  <button
                    type="button"
                    className="actionBtn btnCopy"
                    style={{ flex: 1, fontSize: '0.65rem', padding: '4px 0' }}
                    onClick={() => copy(img)}
                  >
                    ⎘ Copy
                  </button>
                )}
                {img.source === 'local' && img.id !== undefined && (
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
                    onClick={() => handleDelete(img.id!)}
                  >
                    削除
                  </button>
                )}
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
            src={getDisplayUrl(expanded)}
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
            {expanded.source === 'local' && expanded.id !== undefined && (
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
                onClick={() => handleDelete(expanded.id!)}
              >
                削除
              </button>
            )}
          </div>
          {expanded.source === 'local' && expanded.prompt && (
            <p style={{ color: '#aaa', fontSize: '0.75rem', marginTop: 10, maxWidth: 400, textAlign: 'center' }}>
              {expanded.prompt}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
