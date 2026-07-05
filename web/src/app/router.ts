export type RouteHandler = () => HTMLElement;

export interface Route {
  path: string;
  title: string;
  render: RouteHandler;
  nav?: boolean;
  navLabel?: string;
  /** Solo visible/accesible con sesión de profesional de salud */
  medicoOnly?: boolean;
}

const routes: Route[] = [];

export function registerRoute(route: Route): void {
  routes.push(route);
}

export function getRoutes(): Route[] {
  return routes;
}

import { getProfessionalSession } from "../registro/session";

export function isMedicoLoggedIn(): boolean {
  return getProfessionalSession() !== null;
}

export function getNavRoutes(): Route[] {
  return routes.filter((r) => r.nav && (!r.medicoOnly || isMedicoLoggedIn()));
}

export function canAccessRoute(route: Route): boolean {
  return !route.medicoOnly || isMedicoLoggedIn();
}

export function matchRoute(hash: string): Route | undefined {
  const path = hash.replace(/^#/, "") || "/";
  const exact = routes.find((r) => r.path === path);
  if (exact) return exact;
  const dynamic = routes.find((r) => {
    if (!r.path.includes(":")) return false;
    const pattern = r.path.replace(/:[^/]+/g, "[^/]+");
    return new RegExp(`^${pattern}$`).test(path);
  });
  if (dynamic) return dynamic;
  return routes.find((r) => r.path === "/");
}

export function navigate(path: string): void {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.hash = normalized;
}

export function onRouteChange(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
