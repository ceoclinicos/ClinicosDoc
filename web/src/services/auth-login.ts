import { ApiCallError } from "../ui/error-dialog";
import { signInWithFirebaseToken } from "./firebase-auth";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

export type AuthLoginRole = "paciente" | "medico" | "clinica";

export type AuthLoginResult = {
  token: string;
  uid: string;
  role: AuthLoginRole | string;
  cedula?: string;
  accountName?: string;
  nombre?: string;
  correo?: string;
  especialidad?: string;
  mpps?: string;
  sexo?: string;
  nacionalidad?: string;
  cloudUserId?: string;
  clinicId?: string;
  rif?: string;
  inviteCode?: string;
  esMedicoGeneral?: boolean;
};

type ApiPayload = AuthLoginResult & {
  error?: string;
  detail?: string;
  code?: string;
};

/**
 * Valida PIN en el servidor, obtiene custom token y abre sesión Firebase Auth.
 */
export async function authLogin(input: {
  tipo: string;
  cedula: string;
  pin: string;
}): Promise<AuthLoginResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: input.tipo,
        cedula: input.cedula,
        pin: input.pin,
      }),
    });
  } catch (err) {
    throw new ApiCallError("No se pudo conectar con el servidor", {
      detail: err instanceof Error ? err.message : String(err),
      code: "NETWORK",
    });
  }

  const raw = await res.text();
  let data: Partial<ApiPayload> = {};
  try {
    data = raw ? (JSON.parse(raw) as Partial<ApiPayload>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new ApiCallError(data.error || "No se pudo iniciar sesión", {
      status: res.status,
      detail: data.detail,
      code: data.code,
      raw: raw || undefined,
    });
  }

  if (!data.token || !data.uid) {
    throw new ApiCallError("Respuesta de autenticación inválida", { raw });
  }

  await signInWithFirebaseToken(data.token);
  return data as AuthLoginResult;
}
