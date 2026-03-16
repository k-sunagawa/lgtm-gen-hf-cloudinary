import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteImage, getAllImages, saveImage, StoredImage } from './imageStore';

interface CloudinaryImage {
  secure_url: string;
  public_id: string;
  created_at: string;
}

type DisplayImage = (StoredImage & { source: 'local' }) | (CloudinaryImage & { source: 'cloudinary' });

interface Props {
  hasCloudinaryAdmin?: boolean;
}

export default function Gallery({ hasCloudinaryAdmin }: Props) {
  const [localImages, setLocalImages] = useState<StoredImage[]>([]);
  const [cloudinaryImages, setCloudinaryImages] = useState<CloudinaryImage[]>([]);
  const [viewMode, setViewMode] = useState<'local' | 'cloudinary'>(hasCloudinaryAdmin ? 'cloudinary' : 'local');
  const [cloudinaryLoading, setCloudinaryLoading] = useState(false);
  const [cloudinaryError, setCloudinaryError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<DisplayImage | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [favoriteMsg, setFavoriteMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCloudinaryImages = useCallback(
    async (nextCursor?: string) => {
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
    },
    [hasCloudinaryAdmin]
  );

  useEffect(() => {
    getAllImages().then(setLocalImages).catch(console.error);
  }, []);

  useEffect(() => {
    if (hasCloudinaryAdmin && viewMode === 'cloudinary' && cloudinaryImages.length === 0 && !cloudinaryLoading) {
      fetchCloudinaryImages();
    }
  }, [hasCloudinaryAdmin, viewMode, cloudinaryImages.length, cloudinaryLoading, fetchCloudinaryImages]);

  const handleDelete = async (id: number) => {
    await deleteImage(id).catch(console.error);
    setLocalImages((prev) => prev.filter((img) => img.id !== id));
    if (expanded && expanded.source === 'local' && expanded.id === id) setExpanded(null);
  };

  const handleAddToFavorites = async (img: CloudinaryImage) => {
    setFavoriteLoading(true);
    setFavoriteMsg(null);
    try {
      const res = await fetch(`/api/fetch-image?url=${encodeURIComponent(img.secure_url)}`);
      const text = await res.text();
      let data: { dataUrl?: string; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('API が正しく応答しませんでした。npm run dev でサーバーが起動しているか確認してください。');
      }
      if (!res.ok) throw new Error(data.error || res.statusText);
      const { dataUrl } = data;
      if (!dataUrl) throw new Error('画像の取得に失敗しました');
      await saveImage({
        dataUrl,
        prompt: img.public_id,
        model: 'Cloudinary',
        timestamp: Date.now(),
        cloudinaryUrl: img.secure_url,
      });
      const updated = await getAllImages();
      setLocalImages(updated);
      setFavoriteMsg({ type: 'success', msg: '⭐ お気に入りに追加しました' });
      setTimeout(() => setFavoriteMsg(null), 3000);
    } catch (err) {
      setFavoriteMsg({ type: 'error', msg: (err as Error).message });
      setTimeout(() => setFavoriteMsg(null), 4000);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleDeleteCloudinary = async (publicId: string) => {
    try {
      const res = await fetch('/api/cloudinary-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: publicId }),
      });
      const text = await res.text();
      let data: { error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        setCloudinaryError(
          'API が HTML を返しました。npm run dev で Vite と Express の両方が起動しているか確認してください。'
        );
        return;
      }
      if (!res.ok) throw new Error(data.error || res.statusText);
      setCloudinaryImages((prev) => prev.filter((img) => img.public_id !== publicId));
      if (expanded && expanded.source === 'cloudinary' && expanded.public_id === publicId) setExpanded(null);
    } catch (err) {
      setCloudinaryError((err as Error).message);
    }
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
        {favoriteMsg && (
          <span style={{ color: favoriteMsg.type === 'success' ? '#27ae60' : '#e74c3c', fontSize: '0.8rem' }}>
            {favoriteMsg.msg}
          </span>
        )}
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
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(img.source === 'cloudinary' || (img.source === 'local' && img.cloudinaryUrl)) && (
                  <button
                    type="button"
                    className="actionBtn btnCopy"
                    style={{ flex: 1, fontSize: '0.65rem', padding: '4px 0', minWidth: 0 }}
                    onClick={() => copy(img)}
                  >
                    ⎘ Copy
                  </button>
                )}
                {img.source === 'cloudinary' && (
                  <button
                    type="button"
                    disabled={favoriteLoading}
                    style={{
                      flex: 1,
                      fontSize: '0.65rem',
                      padding: '4px 0',
                      background: '#f39c12',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: favoriteLoading ? 'not-allowed' : 'pointer',
                      minWidth: 0,
                      opacity: favoriteLoading ? 0.7 : 1,
                    }}
                    onClick={() => handleAddToFavorites(img)}
                  >
                    ⭐
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
                {img.source === 'cloudinary' && (
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
                    onClick={() => handleDeleteCloudinary(img.public_id)}
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
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="actionBtn btnCopy" onClick={() => copy(expanded)}>
              ⎘ Copy Markdown
            </button>
            <button type="button" className="actionBtn btnDownload" onClick={() => setExpanded(null)}>
              閉じる
            </button>
            {expanded.source === 'cloudinary' && (
              <button
                type="button"
                disabled={favoriteLoading}
                style={{
                  background: '#f39c12',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 12px',
                  cursor: favoriteLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  opacity: favoriteLoading ? 0.7 : 1,
                }}
                onClick={() => handleAddToFavorites(expanded)}
              >
                ⭐ お気に入り
              </button>
            )}
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
            {expanded.source === 'cloudinary' && (
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
                onClick={() => handleDeleteCloudinary(expanded.public_id)}
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
