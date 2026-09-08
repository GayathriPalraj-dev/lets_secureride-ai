import { useEffect, useState } from 'react';
import type { CarImage } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
export function CarPrimaryImage({ image }: { image?: CarImage }) {
  const auth = useAuth(),
    [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image) return;
    const abort = new AbortController();
    let object: string;
    void auth.carImageContent!(image.contentUrl, abort.signal)
      .then((blob) => {
        object = URL.createObjectURL(blob);
        setUrl(object);
      })
      .catch(() => undefined);
    return () => {
      abort.abort();
      if (object) URL.revokeObjectURL(object);
    };
  }, [auth.carImageContent, image]);
  return url && image ? (
    <img src={url} alt={image.altText} />
  ) : (
    <div className="car-image-fallback" aria-label="No car image available" />
  );
}
