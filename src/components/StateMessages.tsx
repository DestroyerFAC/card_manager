import type { ReactNode } from 'react';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card-panel flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-red-300">{message}</p>
      {onRetry && (
        <button type="button" className="btn-ghost" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-400">
      <p className="font-semibold text-slate-200">{title}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}
