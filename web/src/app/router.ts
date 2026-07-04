export type RouteHandler = () => HTMLElement;

export interface Route {
  path: string;
  title: string;
  render: RouteHandler;
  nav?: boolean;
  navLabel?: string;
}

const routes: Route[] = [];

export function registerRoute(route: Route): void {
  routes.push(route);
}

export function getRoutes(): Route[] {
  return routes;
}

export function getNavRoutes(): Route[] {
  return routes.filter((r) => r.nav);
}

export function matchRoute(hash: string): Route | undefined {
  const path = hash.replace(/^#/, "") || "/";
  return routes.find((r) => r.path === path) ?? routes.find((r) => r.path === "/");
}

export function navigate(path: string): void {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.hash = normalized;
}

export function onRouteChange(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
