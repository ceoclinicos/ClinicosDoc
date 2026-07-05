import "./styles/app.css";
import { mountShell } from "./app/shell";
import { canAccessRoute, matchRoute, navigate } from "./app/router";
import "./pages";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app no encontrado");

mountShell(root, (main) => {
  const route = matchRoute(window.location.hash);
  if (!route) {
    main.innerHTML = "<p>Ruta no encontrada</p>";
    return;
  }
  if (!canAccessRoute(route)) {
    main.innerHTML = `
      <section class="page">
        <header class="page-header"><h1>Acceso restringido</h1></header>
        <div class="page-body">
          <p class="lead">Las herramientas de consultorio solo están disponibles para profesionales de salud registrados.</p>
          <button type="button" class="btn btn-primary" id="go-prof">Ingresar como profesional</button>
        </div>
      </section>
    `;
    main.querySelector("#go-prof")?.addEventListener("click", () => navigate("/profesional"));
    return;
  }
  main.appendChild(route.render());
});
