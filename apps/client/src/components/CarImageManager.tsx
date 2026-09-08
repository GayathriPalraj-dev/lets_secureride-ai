import type { AdminCarImage } from '@lets-secureride-ai/contracts';
import { useAuth } from '../auth/useAuth';
export function CarImageManager({
  carId,
  images,
  onChanged,
}: {
  carId: string;
  images: AdminCarImage[];
  onChanged(): void;
}) {
  const auth = useAuth();
  async function action(image: AdminCarImage, kind: 'primary' | 'remove') {
    if (kind === 'remove' && !window.confirm('Remove this car image?')) return;
    if (kind === 'primary')
      await auth.primaryCarImage!(carId, image.id, image.revision);
    else await auth.removeCarImage!(carId, image.id, image.revision);
    onChanged();
  }
  if (!images.length) return <p>No images uploaded.</p>;
  return (
    <ul className="car-image-manager">
      {images.map((image) => (
        <li key={image.id}>
          <span>
            {image.altText} — {image.status}
          </span>
          <button
            disabled={image.status !== 'ready' || image.isPrimary}
            onClick={() => void action(image, 'primary')}
          >
            Set primary
          </button>
          <button onClick={() => void action(image, 'remove')}>Remove</button>
        </li>
      ))}
    </ul>
  );
}
