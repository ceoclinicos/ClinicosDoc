import { navigate } from "../app/router";

export function page(title: string, body: string, actions = ""): HTMLElement {
  const el = document.createElement("section");
  el.className = "page";
  el.innerHTML = `
    <header class="page-header">
      <h1>${title}</h1>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </header>
    <div class="page-body">${body}</div>
  `;
  return el;
}

export function emptyState(message: string, ctaLabel?: string, ctaPath?: string): string {
  const cta =
    ctaLabel && ctaPath
      ? `<button type="button" class="btn btn-primary" data-nav="${ctaPath}">${ctaLabel}</button>`
      : "";
  return `<div class="empty-state"><p>${message}</p>${cta}</div>`;
}

export function bindNavButtons(root: HTMLElement): void {
  root.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const path = btn.getAttribute("data-nav");
      if (path) navigate(path);
    });
  });
}
