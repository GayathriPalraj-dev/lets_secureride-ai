import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function DashboardLayout({
  admin = false,
  children,
}: {
  admin?: boolean;
  children: ReactNode;
}) {
  const links: [string, string][] = admin
    ? [
        ['/admin', 'Overview'],
        ['/admin/cars', 'Cars'],
        ['/admin/bookings', 'Bookings'],
        ['/admin/payments', 'Payments'],
      ]
    : [
        ['/account', 'Account'],
        ['/bookings', 'Bookings'],
        ['/cars', 'Find a car'],
      ];
  return (
    <div className="dashboard-layout">
      <aside aria-label={admin ? 'Administration' : 'Customer account'}>
        <p className="sidebar-title">
          {admin ? 'Administration' : 'My SecureRide'}
        </p>
        <nav>
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/account'}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="dashboard-content">{children}</div>
    </div>
  );
}
