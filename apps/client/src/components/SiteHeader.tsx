import { useContext, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import { BrandMark } from './BrandMark';

export function SiteHeader() {
  const auth = useContext(AuthContext);
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';
  const showAuthenticatedNavigation = auth?.status === 'authenticated' && !isAuthRoute;
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);

  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <BrandMark />
        <button
          ref={toggle}
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Toggle navigation</span>
          <span aria-hidden="true">{open ? '×' : '☰'}</span>
        </button>
        <nav
          id="primary-navigation"
          aria-label="Primary navigation"
          className={open ? 'nav-links is-open' : 'nav-links'}
        >
          <NavLink to="/" onClick={close}>
            Home
          </NavLink>
          {showAuthenticatedNavigation && (
            <NavLink to="/cars" onClick={close}>
              Browse cars
            </NavLink>
          )}
          {showAuthenticatedNavigation && (
            <NavLink to="/bookings" onClick={close}>
              My bookings
            </NavLink>
          )}
          {showAuthenticatedNavigation && auth?.user?.role === 'admin' && (
            <NavLink to="/admin" onClick={close}>
              Administration
            </NavLink>
          )}
          {showAuthenticatedNavigation ? (
            <NavLink className="nav-account" to="/account" onClick={close}>
              Account
            </NavLink>
          ) : (
            <>
              <NavLink to="/login" onClick={close}>
                Sign in
              </NavLink>
              <NavLink
                className="button button-small"
                to="/register"
                onClick={close}
              >
                Create account
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
