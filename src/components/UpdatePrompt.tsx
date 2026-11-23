import { useRegisterSW } from 'virtual:pwa-register/react';

/** `registerType: 'prompt'`: a new version never reloads the page under the user's feet. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-50 flex items-center justify-between gap-3 rounded-2xl bg-panel-2 p-3 shadow-lg">
      <span className="text-sm">Une nouvelle version est disponible.</span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setNeedRefresh(false);
          }}
        >
          Plus tard
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            void updateServiceWorker(true);
          }}
        >
          Mettre à jour
        </button>
      </div>
    </div>
  );
}
