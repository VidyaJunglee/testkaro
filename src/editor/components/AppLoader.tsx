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
      <div className="flex flex-col h-screen bg-bg-primary">
        {/* Skeleton TopBar — same height as real one to prevent layout jump */}
        <div className="flex items-center h-14 px-4 bg-bg-secondary border-b border-border shrink-0 gap-3">
          <div className="w-7 h-7 bg-accent rounded-md shrink-0" />
          <div className="w-20 h-3.5 bg-bg-tertiary rounded" />
          <div className="w-px h-6 bg-border" />
          <div className="w-32 h-3 bg-bg-tertiary rounded" />
          <div className="flex-1" />
          <div className="w-20 h-6 bg-bg-tertiary rounded-lg" />
          <div className="w-16 h-7 bg-accent/20 rounded-lg" />
        </div>
        <div className="flex-1 flex items-center justify-center gap-3">
          <Loader2 size={18} className="text-accent animate-spin" />
          <span className="text-sm text-text-secondary">Loading…</span>
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent/90 transition-colors"
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
