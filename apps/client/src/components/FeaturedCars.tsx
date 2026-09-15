import { Link } from 'react-router-dom';
const categories = [
  {
    name: 'City compact',
    tag: 'Easy city driving',
    kind: 'hatchback',
    image: '/images/car-electric.webp',
  },
  {
    name: 'Family comfort',
    tag: 'Space for every plan',
    kind: 'suv',
    image: '/images/car-suv.webp',
  },
  {
    name: 'Premium journey',
    tag: 'Arrive in style',
    kind: 'luxury',
    image: '/images/car-luxury.webp',
  },
];
export function FeaturedCars() {
  return (
    <section className="section shell" aria-labelledby="featured-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Find your fit</p>
          <h2 id="featured-heading">A car for every kind of journey</h2>
        </div>
        <Link to="/cars">
          View all cars <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="feature-grid">
        {categories.map((item, index) => (
          <article
            className={`feature-card feature-card-${index + 1}`}
            key={item.kind}
          >
            <div className="feature-visual">
              <img src={item.image} alt={`${item.name} vehicle`} />
            </div>
            <p className="eyebrow">{item.tag}</p>
            <h3>{item.name}</h3>
            <Link to={`/cars?category=${item.kind}`}>Explore {item.kind}s</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
