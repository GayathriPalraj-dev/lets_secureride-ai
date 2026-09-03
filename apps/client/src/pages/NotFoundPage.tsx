import { Link } from 'react-router-dom';
export function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>This page is not available.</p>
      <Link to="/">Return to lets_secureride-ai</Link>
    </main>
  );
}
