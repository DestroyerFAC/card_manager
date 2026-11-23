import { envError } from '../lib/env';

export function ConfigurationError() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold text-red-300">Configuration manquante</h1>
      <p className="mt-2 text-sm text-slate-300">
        Définissez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY (voir .env.example).
      </p>
      {import.meta.env.DEV && envError && (
        <pre className="mt-4 overflow-auto rounded-lg bg-panel p-3 text-xs">{envError}</pre>
      )}
    </main>
  );
}
