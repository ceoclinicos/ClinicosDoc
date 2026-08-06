export type RouteHandler = () => HTMLElement;

export interface Route {
  path: string;
  title: string;
  render: RouteHandler;
  nav?: boolean;
  navLabel?: string;
  /** Solo visible/accesible con sesión de profesional de salud */
  medicoOnly?: boolean;
  /** Solo con sesión de clínica / centro de salud */
  clinicOnly?: boolean;
}

const routes: Route[] = [];

export function registerRoute(route: Route): void {
  routes.push(route);
}

export function getRoutes(): Route[] {
  return routes;
}

import { getProfessionalSession } from "../registro/session";
import { getClinicSession } from "../clinic/session";

export function isMedicoLoggedIn(): boolean {
  return getProfessionalSession() !== null;
}

export function isClinicLoggedIn(): boolean {
  return getClinicSession() !== null;
}

export function getNavRoutes(): Route[] {
  if (isClinicLoggedIn()) {
    return routes.filter((r) => r.nav && r.clinicOnly);
  }
  return routes.filter((r) => r.nav && !r.clinicOnly && (!r.medicoOnly || isMedicoLoggedIn()));
}

export function canAccessRoute(route: Route): boolean {
  if (route.clinicOnly) return isClinicLoggedIn();
  if (route.medicoOnly) return isMedicoLoggedIn();
  return true;
}

export function matchRoute(hash: string): Route | undefined {
  // Quitar ?query del hash (#/restablecer-pin?token=...) para poder casar la ruta
  const path = (hash.replace(/^#/, "").split("?")[0] || "/") || "/";
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
