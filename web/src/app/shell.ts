import { getNavRoutes, matchRoute, navigate, onRouteChange } from "./router";
import { isUserLoggedIn, logoutAllSessions } from "../registro/session";

function navHtml(): string {
  const items = getNavRoutes();
  const links = items
    .map(
      (r) =>
        `<a href="#${r.path}" class="nav-link" data-path="${r.path}">${r.navLabel ?? r.title}</a>`,
    )
    .join("");
  const logout = isUserLoggedIn()
    ? `<button type="button" class="nav-link nav-link-logout" id="btn-nav-logout">Cerrar sesión</button>`
    : "";
  return links + logout;
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
        <a href="#/" class="brand-row">
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

  function renderNav(): void {
    topnav.innerHTML = navHtml();
    bottomnav.innerHTML = navHtml();
    bindLogout(topnav);
    bindLogout(bottomnav);

    const current = matchRoute(window.location.hash)?.path ?? "/";
    root.querySelectorAll(".nav-link[data-path]").forEach((a) => {
      a.classList.toggle("active", a.getAttribute("data-path") === current);
    });
  }

  function render(): void {
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
