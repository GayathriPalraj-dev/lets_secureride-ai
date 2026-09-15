export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
