import type { ReactNode } from 'react';
export function PageIntro({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-intro">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div>
        <div>
          <h1>{title}</h1>
          {children && <p>{children}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
  );
}
