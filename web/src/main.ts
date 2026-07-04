import "./styles/app.css";
import { mountShell } from "./app/shell";
import { matchRoute } from "./app/router";
import "./pages";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app no encontrado");

mountShell(root, (main) => {
  const route = matchRoute(window.location.hash);
  if (!route) {
    main.innerHTML = "<p>Ruta no encontrada</p>";
    return;
  }
  main.appendChild(route.render());
});
