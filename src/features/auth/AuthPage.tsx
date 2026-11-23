import { useState, type SubmitEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { formString } from '../../lib/forms';

const credentialsSchema = z.object({
  email: z.email('Adresse email invalide').max(254),
  password: z.string().min(8, '8 caractères minimum').max(72, '72 caractères maximum'), // bcrypt truncates beyond 72 bytes
});

type Mode = 'signIn' | 'signUp';

/** Only same-app relative paths are honoured: prevents open redirects via router state. */
function safeRedirect(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from = state.from;
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from;
  }
  return '/';
}

export function AuthPage() {
  const auth = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signIn');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (auth.state.status === 'signedIn')
    return <Navigate to={safeRedirect(location.state)} replace />;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({
      email: formString(form, 'email').trim(),
      password: formString(form, 'password'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide');
      return;
    }

    setPending(true);
    if (mode === 'signIn') {
      const result = await auth.signIn(parsed.data.email, parsed.data.password);
      if (!result.ok) setError(result.error.message);
    } else {
      const result = await auth.signUp(parsed.data.email, parsed.data.password);
      if (!result.ok) setError(result.error.message);
      else if (result.value.needsConfirmation) {
        setInfo('Compte créé. Consultez vos emails pour confirmer votre adresse.');
        setMode('signIn');
      }
    }
    setPending(false);
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Card Manager</h1>
        <p className="mt-1 text-sm text-slate-400">Votre collection de cartes Pokémon, estimée.</p>
      </div>

      <div className="grid grid-cols-2 rounded-xl bg-panel p-1" role="tablist">
        {(['signIn', 'signUp'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold ${mode === m ? 'bg-panel-2 text-accent' : 'text-slate-400'}`}
          >
            {m === 'signIn' ? 'Connexion' : 'Inscription'}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3" noValidate>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" autoComplete="email" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <input
            name="password"
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            minLength={8}
            maxLength={72}
            required
            className="input"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        {info && <p className="text-sm text-emerald-300">{info}</p>}
        <button type="submit" className="btn-primary mt-2" disabled={pending}>
          {pending ? 'Patientez…' : mode === 'signIn' ? 'Se connecter' : 'Créer un compte'}
        </button>
      </form>
    </main>
  );
}
