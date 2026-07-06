const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

export async function requestPinReset(cedula: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/pin-reset-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cedula }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo enviar el correo");
  return data.message || "Revise su correo.";
}

export async function confirmPinReset(token: string, pin: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/pin-reset-confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, pin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo restablecer el PIN");
  return data.message || "PIN actualizado.";
}
