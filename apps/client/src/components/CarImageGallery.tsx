import type { CarImage } from '@lets-secureride-ai/contracts';
import { CarPrimaryImage } from './CarPrimaryImage';
export function CarImageGallery({ images }: { images: CarImage[] }) {
  if (!images.length) return <p>No images available.</p>;
  return (
    <section className="car-image-gallery" aria-label="Car images">
      {[...images]
        .sort(
          (a, b) =>
            Number(b.isPrimary) - Number(a.isPrimary) ||
            a.displayOrder - b.displayOrder,
        )
        .map((image) => (
          <figure key={image.id}>
            <CarPrimaryImage image={image} />
            <figcaption>{image.altText}</figcaption>
          </figure>
        ))}
    </section>
  );
}
