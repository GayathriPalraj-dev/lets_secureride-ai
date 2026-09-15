import { Link } from 'react-router-dom';
import { FeaturedCars } from '../components/FeaturedCars';
import { HomeSearch } from '../components/HomeSearch';
import { TrustSection } from '../components/TrustSection';

export function HomePage() {
  return (
    <main id="main">
      <section className="hero">
        <div className="shell hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Travel further. Feel safer.</p>
            <h1>Book your ride with confidence.</h1>
            <p>
              Premium cars, clear daily pricing and secure booking from the
              first search to the final mile.
            </p>
            <div className="page-actions">
              <Link className="button button-accent" to="/cars">
                Find a car <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-secondary" to="/register">
                Create an account
              </Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <p>
              More roads.
              <br />
              Brighter days.
            </p>
          </div>
        </div>
      </section>
      <HomeSearch />
      <FeaturedCars />
      <TrustSection />
      <section
        className="section journey-section"
        aria-labelledby="journey-title"
      >
        <div className="shell">
          <div className="section-heading section-heading-centered">
            <div>
              <p className="eyebrow">Simple. Secure. On the road.</p>
              <h2 id="journey-title">How SecureRide works</h2>
            </div>
          </div>
          <ol className="journey-grid">
            <li>
              <div className="journey-image">
                <img src="/images/step-browse.webp" alt="A selection of verified cars ready to browse" />
                <span>1</span>
              </div>
              <div className="journey-copy">
                <h3>Browse and choose</h3>
                <p>Compare active cars, features and transparent daily rates.</p>
              </div>
            </li>
            <li>
              <div className="journey-image">
                <img src="/images/step-book.webp" alt="Selecting car booking dates on a tablet" />
                <span>2</span>
              </div>
              <div className="journey-copy">
                <h3>Book in minutes</h3>
                <p>
                  Select your dates and review the full price before confirming.
                </p>
              </div>
            </li>
            <li>
              <div className="journey-image">
                <img src="/images/step-pay.webp" alt="Making a secure contactless car rental payment" />
                <span>3</span>
              </div>
              <div className="journey-copy">
                <h3>Pay securely</h3>
                <p>Complete payment through the protected Stripe checkout.</p>
              </div>
            </li>
            <li>
              <div className="journey-image">
                <img src="/images/step-journey.webp" alt="Car travelling on a scenic coastal road" />
                <span>4</span>
              </div>
              <div className="journey-copy">
                <h3>Enjoy the journey</h3>
                <p>Manage your trip from one clear, secure account.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
      <section className="home-cta">
        <div className="shell home-cta-inner">
          <div>
            <p className="eyebrow">Your next road starts here</p>
            <h2>Ready for a safer way to travel?</h2>
          </div>
          <Link className="button button-accent" to="/cars">
            Browse available cars
          </Link>
        </div>
      </section>
    </main>
  );
}
