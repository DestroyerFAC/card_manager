import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../features/auth/AuthContext';
import { Disclaimer } from './Disclaimer';
import { UpdatePrompt } from './UpdatePrompt';
import { useOnlineStatus } from './useOnlineStatus';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Recherche',
    icon: 'M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  },
  {
    to: '/scan',
    label: 'Scan',
    icon: 'M4 7V4h3V2H2v5h2Zm13-5v2h3v3h2V2h-5ZM4 17H2v5h5v-2H4v-3Zm16 3h-3v2h5v-5h-2v3ZM7 11h10v2H7v-2Z',
  },
  {
    to: '/collection',
    label: 'Collection',
    icon: 'M4 6h12v14H4V6Zm2 2v10h8V8H6Zm12-4v14h-2V6H8V4h10Z',
  },
] as const;

export function Layout() {
  const { signOut } = useAuth();
  const online = useOnlineStatus();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-surface/90 px-4 py-3 backdrop-blur">
        <span className="text-lg font-bold">
          Card<span className="text-accent">Manager</span>
        </span>
        <button
          type="button"
          className="text-sm text-slate-400 hover:text-slate-100"
          onClick={() => void signOut()}
        >
          Déconnexion
        </button>
      </header>

      {!online && (
        <p role="status" className="bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-200">
          Hors ligne : seules les pages et images déjà consultées sont disponibles.
        </p>
      )}

      <main className="flex-1 px-4 pt-2 pb-28">
        <Outlet />
        <Disclaimer />
      </main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-1 text-xs ${isActive ? 'text-accent' : 'text-slate-400'}`
                }
              >
                <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <UpdatePrompt />
    </div>
  );
}
