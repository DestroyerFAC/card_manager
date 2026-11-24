import { useMemo, type ReactNode } from 'react';
import { createBrowserRouter, Link, Outlet, RouterProvider } from 'react-router';
import { Layout } from './components/Layout';
import { EmptyState } from './components/StateMessages';
import { AuthPage } from './features/auth/AuthPage';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { RequireAuth } from './features/auth/RequireAuth';
import { CollectionProvider } from './features/collection/CollectionContext';
import { CollectionRepository } from './features/collection/collectionRepository';
import { PriceProviderContext } from './features/collection/usePrices';
import { SearchPage } from './features/search/SearchPage';
import type { AppSupabaseClient } from './lib/supabase/client';
import { EdgeFunctionPriceProvider } from './providers/prices/EdgeFunctionPriceProvider';

/** User-scoped services, remounted per user so no state leaks between accounts. */
function SessionServices({ client, children }: { client: AppSupabaseClient; children: ReactNode }) {
  const { state } = useAuth();
  const userId = state.status === 'signedIn' ? state.session.user.id : null;
  const repository = useMemo(() => new CollectionRepository(client), [client]);
  const prices = useMemo(() => new EdgeFunctionPriceProvider(client), [client]);

  return (
    <PriceProviderContext.Provider value={prices}>
      <CollectionProvider key={userId ?? 'anonymous'} repository={repository}>
        {children}
      </CollectionProvider>
    </PriceProviderContext.Provider>
  );
}

function NotFound() {
  return (
    <EmptyState title="Page introuvable">
      <Link to="/" className="text-accent underline">
        Retour à la recherche
      </Link>
    </EmptyState>
  );
}

export function App({ client }: { client: AppSupabaseClient }) {
  const router = useMemo(
    () =>
      createBrowserRouter([
        { path: '/login', element: <AuthPage /> },
        {
          element: (
            <RequireAuth>
              <SessionServices client={client}>
                <Outlet />
              </SessionServices>
            </RequireAuth>
          ),
          children: [
            {
              element: <Layout />,
              children: [
                { index: true, element: <SearchPage /> },
                // Route-level code splitting: the OCR engine is only fetched when scanning.
                {
                  path: 'set/:setId',
                  lazy: async () => ({
                    Component: (await import('./features/search/SetPage')).SetPage,
                  }),
                },
                {
                  path: 'card/:cardId',
                  lazy: async () => ({
                    Component: (await import('./features/search/CardDetailPage')).CardDetailPage,
                  }),
                },
                {
                  path: 'collection',
                  lazy: async () => ({
                    Component: (await import('./features/collection/CollectionPage'))
                      .CollectionPage,
                  }),
                },
                {
                  path: 'scan',
                  lazy: async () => ({
                    Component: (await import('./features/scan/ScanPage')).ScanPage,
                  }),
                },
                { path: '*', element: <NotFound /> },
              ],
            },
          ],
        },
      ]),
    [client],
  );

  return (
    <AuthProvider client={client}>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
