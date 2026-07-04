import { getNavRoutes, matchRoute, navigate, onRouteChange } from "./router";

export function mountShell(root: HTMLElement, renderPage: (el: HTMLElement) => void): void {
  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a href="#/" class="brand">Clínicos Doc</a>
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
    const items = getNavRoutes();
    const links = items
      .map(
        (r) =>
          `<a href="#${r.path}" class="nav-link" data-path="${r.path}">${r.navLabel ?? r.title}</a>`,
      )
      .join("");
    topnav.innerHTML = links;
    bottomnav.innerHTML = links;

    const current = matchRoute(window.location.hash)?.path ?? "/";
    root.querySelectorAll(".nav-link").forEach((a) => {
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
  render();
}

export { navigate };
