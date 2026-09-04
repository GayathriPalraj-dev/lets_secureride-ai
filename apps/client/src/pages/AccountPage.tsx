import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { Link } from 'react-router-dom';
export function AccountPage() {
  const auth = useAuth();
  const [pending, setPending] = useState(false);
  async function logout(all: boolean) {
    setPending(true);
    try {
      await auth.logout(all);
    } catch {
      /* Provider displays the safe failure. */
    } finally {
      setPending(false);
    }
  }
  return (
    <main>
      <h1>Your account</h1>
      <p>{auth.user?.email}</p>
      <p>Role: {auth.user?.role}</p>
      {auth.user?.role === 'admin' && <Link to="/admin">Administration</Link>}
      <button
        disabled={pending}
        onClick={() => {
          void logout(false);
        }}
      >
        Sign out
      </button>
      <button
        disabled={pending}
        onClick={() => {
          void logout(true);
        }}
      >
        Sign out all devices
      </button>
    </main>
  );
}
