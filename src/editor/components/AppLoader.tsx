// ─── AppLoader ───────────────────────────────────────────────────────────────
// Thin React bridge between the router and the store.
// When the route changes to an app, it calls store.loadApp().
// Renders loading/error/not-found states based on store.loadState.

import React, { useEffect } from 'react';
import { useStore, useLoadState, useLoadError, useCurrentAppId } from '../store';
import { AppRoute, navigateToDashboard } from '../router';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

interface Props {
  route: AppRoute;
  children: React.ReactNode;
}

export function AppLoader({ route, children }: Props) {
  const loadState = useLoadState();
  const loadError = useLoadError();
  const currentAppId = useCurrentAppId();

  useEffect(() => {
    // Only load if the route's app/module differs from what's already loaded
    const store = useStore.getState();
    const needsLoad =
      store.currentAppId !== route.appId ||
      store.loadState !== 'ready';

    if (needsLoad) {
      store.loadApp(route.appId, route.moduleId);
    } else if (route.moduleId) {
      // Same app, different module — just switch
      const modIdx = store.modules.findIndex(m => m.id === route.moduleId);
      if (modIdx >= 0 && modIdx !== store.activeModuleIndex) {
        store.switchModule(modIdx);
      }
    }
  }, [route.appId, route.moduleId]);

  if (loadState === 'loading') {
    return (
      <div className="h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-accent animate-spin" />
          <span className="text-sm text-text-secondary">Loading app...</span>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    const isNotFound = loadError?.includes('not found');
    return (
      <div className="h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertTriangle size={32} className={isNotFound ? 'text-warning' : 'text-danger'} />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {isNotFound ? 'App not found' : 'Failed to load'}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {isNotFound ? (
                <>The app <code className="bg-bg-secondary px-1.5 py-0.5 rounded text-xs">{route.appId}</code> does not exist or was deleted.</>
              ) : loadError}
            </p>
          </div>
          <button
            onClick={() => navigateToDashboard()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loadState !== 'ready') {
    // idle state — shouldn't happen in practice since useEffect triggers load
    return null;
  }

  return <>{children}</>;
}
