import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <main>
      <h1>Access denied</h1>
      <p>You do not have permission to view this page.</p>
      <p>
        <Link to="/account">Return to your account</Link>
        {' or '}
        <Link to="/">go home</Link>.
      </p>
    </main>
  );
}
