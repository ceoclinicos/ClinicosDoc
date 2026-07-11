import { ApiCallError } from "../ui/error-dialog";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

type ApiPayload = {
  error?: string;
  message?: string;
  detail?: string;
  code?: string;
};

async function readApiResponse(res: Response): Promise<{ data: ApiPayload; raw: string }> {
  const raw = await res.text();
  let data: ApiPayload = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  return { data, raw };
}

function fail(res: Response, data: ApiPayload, raw: string, fallback: string): never {
  throw new ApiCallError(data.error || fallback, {
    status: res.status,
    detail: data.detail,
    code: data.code,
    raw: raw || undefined,
  });
}

export async function requestPinReset(cedula: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/pin-reset-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula }),
    });
  } catch (err) {
    throw new ApiCallError("No se pudo conectar con el servidor", {
      detail: err instanceof Error ? err.message : String(err),
      code: "NETWORK",
    });
  }

  const { data, raw } = await readApiResponse(res);
  if (!res.ok) fail(res, data, raw, "No se pudo enviar el correo");
  return data.message || "Revise su correo.";
}

export async function confirmPinReset(token: string, pin: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/pin-reset-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, pin }),
    });
  } catch (err) {
    throw new ApiCallError("No se pudo conectar con el servidor", {
      detail: err instanceof Error ? err.message : String(err),
      code: "NETWORK",
    });
  }

  const { data, raw } = await readApiResponse(res);
  if (!res.ok) fail(res, data, raw, "No se pudo restablecer el PIN");
  return data.message || "PIN actualizado.";
}
