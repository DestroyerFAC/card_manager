import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { appError, type AppError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { AppSupabaseClient } from '../../lib/supabase/client';

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'signedOut' }
  | { readonly status: 'signedIn'; readonly session: Session };

interface AuthContextValue {
  readonly state: AuthState;
  readonly signIn: (email: string, password: string) => Promise<Result<void, AppError>>;
  /** `needsConfirmation` = the project requires email confirmation before the first login. */
  readonly signUp: (
    email: string,
    password: string,
  ) => Promise<Result<{ needsConfirmation: boolean }, AppError>>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Supabase error codes are mapped to neutral messages: never reveal whether an email exists.
function toAuthError(code: string | undefined, status: number | undefined): AppError {
  switch (code) {
    case 'invalid_credentials':
      return appError('auth', 'Email ou mot de passe incorrect');
    case 'email_not_confirmed':
      return appError('auth', 'Confirmez votre email avant de vous connecter');
    case 'weak_password':
      return appError('validation', 'Mot de passe trop faible');
    case 'email_address_not_authorized':
      // Supabase's built-in SMTP only mails organisation members until custom SMTP is set up.
      return appError(
        'unavailable',
        'Inscriptions momentanément fermées (envoi d’email non configuré)',
      );
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return appError('auth', 'Trop de tentatives, réessayez dans quelques minutes');
    default:
      return status === undefined
        ? appError('network', 'Service d’authentification injoignable')
        : appError('auth', 'Authentification impossible');
  }
}

export function AuthProvider({
  client,
  children,
}: {
  client: AppSupabaseClient;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(
        data.session ? { status: 'signedIn', session: data.session } : { status: 'signedOut' },
      );
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut' });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async signIn(email, password) {
        try {
          const { error } = await client.auth.signInWithPassword({ email, password });
          return error ? err(toAuthError(error.code, error.status)) : ok(undefined);
        } catch {
          return err(toAuthError(undefined, undefined));
        }
      },
      async signUp(email, password) {
        try {
          const { data, error } = await client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
          if (error) return err(toAuthError(error.code, error.status));
          return ok({ needsConfirmation: data.session === null });
        } catch {
          return err(toAuthError(undefined, undefined));
        }
      },
      async signOut() {
        // Local scope: signing out on this device must work offline too.
        await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      },
    }),
    [client, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
