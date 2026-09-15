import { Link } from 'react-router-dom';

export function BrandMark() {
  return (
    <Link className="brand" to="/" aria-label="SecureRide home">
      <img src="/secureride-mark.svg" alt="" width="38" height="38" />
      <span>
        Secure<span>Ride</span>
      </span>
    </Link>
  );
}
