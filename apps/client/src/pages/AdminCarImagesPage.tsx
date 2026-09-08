import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AdminCarImage } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
import { CarImageManager } from '../components/CarImageManager';
import { CarImageUpload } from '../components/CarImageUpload';
export function AdminCarImagesPage() {
  const { carId = '' } = useParams(),
    auth = useAuth();
  const [images, setImages] = useState<AdminCarImage[]>([]),
    [revision, setRevision] = useState(0),
    [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = await auth.adminCarImages!(carId);
      setImages(data.items);
      setRevision(data.revision);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [auth.adminCarImages, carId]);
  useEffect(() => {
    let active = true;
    void auth.adminCarImages!(carId)
      .then((data) => {
        if (active) {
          setImages(data.items);
          setRevision(data.revision);
          setState('ready');
        }
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [auth.adminCarImages, carId]);
  return (
    <main>
      <h1>Manage car images</h1>
      <Link to="/admin/cars">Back to inventory</Link>
      {state === 'loading' ? (
        <p role="status">Loading images…</p>
      ) : state === 'error' ? (
        <>
          <p role="alert">Unable to load images.</p>
          <button onClick={() => void load()}>Retry</button>
        </>
      ) : (
        <>
          <CarImageUpload
            carId={carId}
            revision={revision}
            onUploaded={() => void load()}
          />
          <CarImageManager
            carId={carId}
            images={images}
            onChanged={() => void load()}
          />
        </>
      )}
    </main>
  );
}
