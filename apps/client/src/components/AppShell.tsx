import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
