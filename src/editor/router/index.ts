// ─── Hash Router ─────────────────────────────────────────────────────────────
// Lightweight production-ready hash-based router for TestKaro.
// Routes: #/ (dashboard), #/app/:appId, #/app/:appId/module/:moduleId
// No external dependencies.

import { useSyncExternalStore, useCallback } from 'react';

// ─── Route Types ─────────────────────────────────────────────────────────────

export interface DashboardRoute {
  page: 'dashboard';
}

export interface AppRoute {
  page: 'app';
  appId: string;
  moduleId?: string;
}

export interface NotFoundRoute {
  page: 'not-found';
  path: string;
}

export type Route = DashboardRoute | AppRoute | NotFoundRoute;

// ─── Route Parsing ───────────────────────────────────────────────────────────

const APP_ROUTE_RE = /^\/app\/([a-zA-Z0-9_-]+)$/;
const APP_MODULE_ROUTE_RE = /^\/app\/([a-zA-Z0-9_-]+)\/module\/([a-zA-Z0-9_-]+)$/;

export function parseHash(hash: string): Route {
  // Strip leading # and normalize
  const path = hash.replace(/^#/, '') || '/';

  if (path === '/') {
    return { page: 'dashboard' };
  }

  // /app/:appId/module/:moduleId
  const moduleMatch = path.match(APP_MODULE_ROUTE_RE);
  if (moduleMatch) {
    return { page: 'app', appId: moduleMatch[1], moduleId: moduleMatch[2] };
  }

  // /app/:appId
  const appMatch = path.match(APP_ROUTE_RE);
  if (appMatch) {
    return { page: 'app', appId: appMatch[1] };
  }

  return { page: 'not-found', path };
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export function navigate(route: Route): void {
  const hash = routeToHash(route);
  window.location.hash = hash;
}

export function routeToHash(route: Route): string {
  switch (route.page) {
    case 'dashboard':
      return '#/';
    case 'app':
      return route.moduleId
        ? `#/app/${route.appId}/module/${route.moduleId}`
        : `#/app/${route.appId}`;
    case 'not-found':
      return '#/';
  }
}

export function navigateToApp(appId: string, moduleId?: string): void {
  navigate({ page: 'app', appId, moduleId });
}

export function navigateToDashboard(): void {
  navigate({ page: 'dashboard' });
}

// ─── Router Store (external store for useSyncExternalStore) ──────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

// Cache the snapshot so useSyncExternalStore gets a stable reference
let cachedHash = typeof window !== 'undefined' ? window.location.hash : '';
let cachedRoute: Route = parseHash(cachedHash);

function updateCache(): void {
  const currentHash = window.location.hash;
  if (currentHash !== cachedHash) {
    cachedHash = currentHash;
    cachedRoute = parseHash(currentHash);
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  const handler = () => {
    updateCache();
    listeners.forEach(l => l());
  };
  window.addEventListener('hashchange', handler);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', handler);
  };
}

function getSnapshot(): Route {
  updateCache();
  return cachedRoute;
}

const SERVER_ROUTE: Route = { page: 'dashboard' };
function getServerSnapshot(): Route {
  return SERVER_ROUTE;
}

// ─── React Hook ──────────────────────────────────────────────────────────────

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useNavigate() {
  return useCallback((route: Route) => navigate(route), []);
}
