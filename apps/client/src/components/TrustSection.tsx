const items = [
  {
    title: 'Verified vehicles',
    text: 'Clear inventory status and dependable vehicle details.',
    image: '/images/step-browse.webp',
    alt: 'A verified selection of rental vehicles',
    icon: '✓',
  },
  {
    title: 'Secure booking',
    text: 'Protected accounts and server-authoritative pricing.',
    image: '/images/step-pay.webp',
    alt: 'A secure contactless car rental payment',
    icon: '⌁',
  },
  {
    title: 'Flexible journeys',
    text: 'Straightforward booking status and cancellation controls.',
    image: '/images/step-journey.webp',
    alt: 'A flexible journey along a scenic coastal road',
    icon: '↗',
  },
];
export function TrustSection() {
  return (
    <section className="trust-section">
      <div className="shell">
        <p className="eyebrow">Why SecureRide</p>
        <h2>Confidence from search to return</h2>
        <div className="trust-grid">
          {items.map(({ title, text, image, alt, icon }) => (
            <article key={title}>
              <div className="trust-image">
                <img src={image} alt={alt} />
              </div>
              <div className="trust-copy">
                <span aria-hidden="true">{icon}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
