import { ApiCallError } from "../ui/error-dialog";
import { signInWithFirebaseToken } from "./firebase-auth";
import type { AuthLoginResult } from "./auth-login";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

/**
 * Crea cuenta vía Admin API y abre sesión Firebase Auth.
 * Evita "missing or insufficient permissions" con rules cerradas.
 */
export async function authRegister(body: Record<string, unknown>): Promise<AuthLoginResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth-register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiCallError("No se pudo conectar con el servidor", {
      detail: err instanceof Error ? err.message : String(err),
      code: "NETWORK",
    });
  }

  const raw = await res.text();
  let data: Partial<AuthLoginResult> & { error?: string; detail?: string; code?: string } = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new ApiCallError(data.error || "No se pudo registrar", {
      status: res.status,
      detail: data.detail,
      code: data.code,
      raw: raw || undefined,
    });
  }
  if (!data.token || !data.uid) {
    throw new ApiCallError("Respuesta de registro inválida", { raw });
  }

  await signInWithFirebaseToken(data.token);
  return data as AuthLoginResult;
}
