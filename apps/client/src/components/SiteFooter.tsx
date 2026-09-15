import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <BrandMark />
          <p>Secure, straightforward car booking for every journey.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link to="/">Home</Link>
          <Link to="/cars">Browse cars</Link>
          <Link to="/account">Account</Link>
        </nav>
        <p className="footer-meta">
          © {new Date().getFullYear()} SecureRide. Built for safe journeys.
        </p>
      </div>
    </footer>
  );
}
