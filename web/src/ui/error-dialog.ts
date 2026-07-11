export class ApiCallError extends Error {
  status?: number;
  detail?: string;
  code?: string;
  raw?: string;

  constructor(message: string, extra?: Partial<ApiCallError>) {
    super(message);
    this.name = "ApiCallError";
    Object.assign(this, extra);
  }

  copyText(): string {
    const lines = [
      `Mensaje: ${this.message}`,
      this.status != null ? `HTTP: ${this.status}` : "",
      this.code ? `Código: ${this.code}` : "",
      this.detail ? `Detalle: ${this.detail}` : "",
      this.raw ? `Respuesta: ${this.raw}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }
}

export function showErrorDialog(summary: string, err: unknown): void {
  const apiErr = err instanceof ApiCallError ? err : null;
  const detail =
    apiErr?.copyText() ||
    (err instanceof Error ? `${err.name}: ${err.message}` : String(err));

  let dialog = document.getElementById("global-error-dialog") as HTMLDialogElement | null;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "global-error-dialog";
    dialog.innerHTML = `
      <h2 id="error-dialog-title">Error</h2>
      <p id="error-dialog-summary"></p>
      <label class="error-dialog-label">Detalle (copie y comparta si necesita ayuda)</label>
      <textarea id="error-dialog-detail" class="error-dialog-detail" readonly rows="8"></textarea>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" id="error-dialog-copy">Copiar</button>
        <button type="button" class="btn btn-primary" id="error-dialog-close">Cerrar</button>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector("#error-dialog-close")?.addEventListener("click", () => dialog?.close());
    dialog.querySelector("#error-dialog-copy")?.addEventListener("click", async () => {
      const ta = dialog?.querySelector("#error-dialog-detail") as HTMLTextAreaElement;
      const text = ta?.value || "";
      try {
        await navigator.clipboard.writeText(text);
        const btn = dialog?.querySelector("#error-dialog-copy") as HTMLButtonElement;
        if (btn) {
          const prev = btn.textContent;
          btn.textContent = "Copiado";
          setTimeout(() => {
            btn.textContent = prev;
          }, 1500);
        }
      } catch {
        ta?.select();
      }
    });
  }

  const summaryEl = dialog.querySelector("#error-dialog-summary") as HTMLElement;
  const detailEl = dialog.querySelector("#error-dialog-detail") as HTMLTextAreaElement;
  if (summaryEl) summaryEl.textContent = summary;
  if (detailEl) detailEl.value = detail;

  if (!dialog.open) dialog.showModal();
}
