const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

export type MppsValidationOk = {
  ok: true;
  source: string;
  medico: {
    cedula: string;
    nombre: string;
    apellido: string;
    nombreCompleto: string;
    profesion: string;
    mpps: string;
  };
};

export type MppsValidationFail = {
  ok: false;
  error: string;
  code?: string;
};

export async function validarMpps(cedula: string, mpps: string): Promise<MppsValidationOk> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/validar-mpps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula, mpps }),
    });
  } catch (err) {
    throw new Error(
      err instanceof Error ? `Sin conexión para validar MPPS: ${err.message}` : "Sin conexión para validar MPPS",
    );
  }

  const data = (await res.json().catch(() => ({}))) as MppsValidationOk | MppsValidationFail;
  if (!res.ok || !data.ok) {
    const fail = data as MppsValidationFail;
    throw new Error(fail.error || "No se pudo validar cédula y MPPS");
  }
  return data as MppsValidationOk;
}
