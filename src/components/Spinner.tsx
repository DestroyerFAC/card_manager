export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-slate-400">
      <span className="size-5 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
