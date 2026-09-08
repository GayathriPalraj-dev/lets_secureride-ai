import { useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';

export function CarImageUpload({
  carId,
  revision,
  onUploaded,
}: {
  carId: string;
  revision: number;
  onUploaded(): void;
}) {
  const auth = useAuth(),
    abort = useRef<AbortController | undefined>(undefined),
    [file, setFile] = useState<File>(),
    [alt, setAlt] = useState(''),
    [progress, setProgress] = useState(0),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(''),
    [cancelled, setCancelled] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError('');
    setCancelled(false);
    setProgress(0);
    abort.current = new AbortController();
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const checksum = btoa(String.fromCharCode(...new Uint8Array(digest)));
      const authorization = await auth.authorizeCarImage!(
        carId,
        {
          contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
          size: file.size,
          checksumSha256: checksum,
          altText: alt,
        },
        revision,
      );
      const requests = (
        await import('../services/car-images')
      ).createCarImageRequests();
      await requests.upload(
        authorization.upload,
        file,
        setProgress,
        abort.current.signal,
      );
      await auth.completeCarImage!(
        carId,
        authorization.image.id,
        authorization.image.revision,
      );
      setFile(undefined);
      setAlt('');
      setProgress(0);
      onUploaded();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError')
        setCancelled(true);
      else setError('Unable to upload this image.');
    } finally {
      setUploading(false);
      abort.current = undefined;
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label>
        Image
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(event) => setFile(event.target.files?.[0])}
        />
      </label>
      <label>
        Alternative text
        <input
          value={alt}
          maxLength={160}
          required
          onChange={(event) => setAlt(event.target.value)}
        />
      </label>
      <button type="submit" disabled={!file || !alt.trim() || uploading}>
        Upload image
      </button>
      {progress > 0 && (
        <progress aria-label="Upload progress" max={100} value={progress} />
      )}
      {uploading && (
        <button type="button" onClick={() => abort.current?.abort()}>
          Cancel upload
        </button>
      )}
      {cancelled && <p role="status">Upload cancelled.</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
