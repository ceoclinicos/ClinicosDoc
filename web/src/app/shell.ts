import { getNavRoutes, isMedicoLoggedIn, matchRoute, navigate, onRouteChange } from "./router";
import { getPatientSession, isUserLoggedIn, logoutAllSessions } from "../registro/session";

function linksHtml(
  items: { path: string; title: string; navLabel?: string }[],
  withLogout: boolean,
): string {
  const links = items
    .map(
      (r) =>
        `<a href="#${r.path}" class="nav-link" data-path="${r.path}">${r.navLabel ?? r.title}</a>`,
    )
    .join("");
  const logout =
    withLogout && isUserLoggedIn()
      ? `<button type="button" class="nav-link nav-link-logout" id="btn-nav-logout">Cerrar sesión</button>`
      : "";
  return links + logout;
}

/** Bottom bar tipo app: Home | Paciente | Informe */
function bottomNavItems() {
  if (!isMedicoLoggedIn()) {
    const patient = getPatientSession();
    if (patient) {
      // Paciente logueado: no “Inicio”, solo su portal / ficha
      return [{ path: "/paciente", title: "Mi ficha", navLabel: "Mi ficha" }];
    }
    return getNavRoutes().filter((r) => !r.medicoOnly);
  }
  const all = getNavRoutes();
  const order = ["/", "/pacientes", "/informes"];
  return order
    .map((p) => all.find((r) => r.path === p))
    .filter((r): r is NonNullable<typeof r> => !!r);
}

function topNavItems() {
  if (getPatientSession() && !isMedicoLoggedIn()) {
    return [
      { path: "/paciente", title: "Mi ficha", navLabel: "Mi ficha" },
      { path: "/ayudemos", title: "Ayudemos", navLabel: "Ayudemos" },
    ];
  }
  return getNavRoutes();
}

function bindLogout(root: HTMLElement): void {
  root.querySelector("#btn-nav-logout")?.addEventListener("click", () => {
    logoutAllSessions();
    navigate("/");
  });
}

export function mountShell(root: HTMLElement, renderPage: (el: HTMLElement) => void): void {
  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a href="#/" class="brand-row" id="brand-home">
          <img src="/img/logo.png" alt="Clínicos Doc" class="brand-logo" width="40" height="40" />
          <span class="brand">Clínicos Doc</span>
          <img src="/img/bandera_venezuela.png" alt="Bandera de Venezuela" class="brand-flag" width="48" height="32" />
        </a>
        <nav class="topnav" id="topnav"></nav>
      </header>
      <main class="main" id="main"></main>
      <nav class="bottomnav" id="bottomnav" aria-label="Navegación principal"></nav>
    </div>
  `;

  const main = root.querySelector("#main") as HTMLElement;
  const topnav = root.querySelector("#topnav") as HTMLElement;
  const bottomnav = root.querySelector("#bottomnav") as HTMLElement;

  root.querySelector("#brand-home")?.addEventListener("click", (e) => {
    if (getPatientSession() && !isMedicoLoggedIn()) {
      e.preventDefault();
      navigate("/paciente");
    }
  });

  function renderNav(): void {
    topnav.innerHTML = linksHtml(topNavItems(), true);
    bottomnav.innerHTML = linksHtml(bottomNavItems(), false);
    bindLogout(topnav);
    bindLogout(bottomnav);

    const current = matchRoute(window.location.hash)?.path ?? "/";
    const activePath =
      getPatientSession() && !isMedicoLoggedIn() && (current === "/" || current === "/paciente")
        ? "/paciente"
        : current;
    root.querySelectorAll(".nav-link[data-path]").forEach((a) => {
      a.classList.toggle("active", a.getAttribute("data-path") === activePath);
    });
  }

  function render(): void {
    const raw = (window.location.hash.replace(/^#/, "").split("?")[0] || "/") || "/";
    if ((raw === "/" || raw === "") && getPatientSession() && !isMedicoLoggedIn()) {
      navigate("/paciente");
      return;
    }
    renderNav();
    main.innerHTML = "";
    renderPage(main);
    document.title = `${matchRoute(window.location.hash)?.title ?? "Clínicos Doc"} · Clínicos Doc`;
  }

  onRouteChange(render);
  window.addEventListener("sessionchange", render);
  render();
}

export { navigate };
