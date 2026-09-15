import type { ReactNode } from 'react';
export function StatusPanel({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={`status-panel status-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="status-icon" aria-hidden="true">
        {tone === 'success'
          ? '✓'
          : tone === 'error'
            ? '!'
            : tone === 'warning'
              ? '!'
              : 'i'}
      </span>
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      {action && <div className="status-action">{action}</div>}
    </section>
  );
}
