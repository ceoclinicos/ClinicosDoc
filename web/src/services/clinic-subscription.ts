import { getIdToken } from "./firebase-auth";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

export type ClinicTierId = "free" | "tier_10" | "tier_25" | "tier_50" | "tier_250";

export type ClinicSubscriptionStatus = {
  plan: string;
  tier: ClinicTierId;
  neededTier: ClinicTierId;
  teamSize: number;
  maxDoctors: number;
  syncActive: boolean;
  canUseAi: boolean;
  canInvite: boolean;
  devices: { max: number; registered: number };
  period: { uses: number; quota: number; remaining: number; endAt: string | null };
  tiers: { id: string; maxDoctors: number; label: string; priceUsd: number }[];
  message: string;
  code: string;
};

export async function fetchClinicSubscriptionStatus(): Promise<ClinicSubscriptionStatus> {
  const token = await getIdToken(true);
  if (!token) throw new Error("Sesión de centro vencida. Vuelva a iniciar sesión.");
  const res = await fetch(`${API_BASE}/api/clinic-subscription-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await res.text();
  let data: ClinicSubscriptionStatus & { error?: string } = {} as ClinicSubscriptionStatus;
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : ({} as typeof data);
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(data.error || "No se pudo leer el plan del centro");
  return data;
}

export async function activateClinicSubscription(tier: ClinicTierId): Promise<ClinicSubscriptionStatus> {
  const token = await getIdToken(true);
  if (!token) throw new Error("Sesión de centro vencida.");
  const res = await fetch(`${API_BASE}/api/clinic-subscription-activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tier }),
  });
  const raw = await res.text();
  let data: { entitlement?: ClinicSubscriptionStatus; error?: string; message?: string } = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(data.error || "No se pudo activar la suscripción");
  if (!data.entitlement) throw new Error("Respuesta inválida del servidor");
  return data.entitlement;
}
