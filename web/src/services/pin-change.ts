import { ApiCallError } from "../ui/error-dialog";
import { getIdToken } from "./firebase-auth";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

/** Actualiza PIN 4→6 (o cualquier PIN de login) estando autenticado. */
export async function changePin(oldPin: string, newPin: string): Promise<void> {
  const token = await getIdToken(true);
  if (!token) throw new ApiCallError("Sesión expirada. Vuelva a iniciar sesión.", { code: "AUTH" });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/pin-change`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPin, newPin }),
    });
  } catch (err) {
    throw new ApiCallError("No se pudo conectar con el servidor", {
      detail: err instanceof Error ? err.message : String(err),
      code: "NETWORK",
    });
  }

  const raw = await res.text();
  let data: { error?: string; detail?: string; code?: string } = {};
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new ApiCallError(data.error || "No se pudo actualizar el PIN", {
      status: res.status,
      detail: data.detail,
      code: data.code,
      raw: raw || undefined,
    });
  }
}
