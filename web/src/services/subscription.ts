import { getIdToken } from "./firebase-auth";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "");

export type EntitlementStatus = {
  canUseAi: boolean;
  plan: string;
  message: string;
  code: string;
  trialGranted?: boolean;
  trial?: {
    daysLeft: number;
    usesLeft: number;
    limitDays: number;
    limitUses: number;
  };
  period?: {
    uses: number;
    quota: number;
    remaining: number;
    endAt: string | null;
    warnLow: boolean;
  };
  courtesyUsed?: boolean;
};

export async function fetchSubscriptionStatus(): Promise<EntitlementStatus> {
  const token = await getIdToken();
  if (!token) throw new Error("Inicie sesión para ver su plan");
  const res = await fetch(`${API_BASE}/api/subscription-status`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = (await res.json()) as EntitlementStatus & { error?: string };
  if (!res.ok) throw new Error(data.error || "No se pudo leer el plan");
  return data;
}

export async function activateSubscription(): Promise<EntitlementStatus> {
  const token = await getIdToken();
  if (!token) throw new Error("Inicie sesión");
  const res = await fetch(`${API_BASE}/api/subscription-activate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
  });
  const data = (await res.json()) as {
    error?: string;
    entitlement?: EntitlementStatus;
  } & EntitlementStatus;
  if (!res.ok) throw new Error(data.error || "No se pudo activar la suscripción");
  return data.entitlement || data;
}

export function formatEntitlementBanner(status: EntitlementStatus): string {
  if (status.message) return status.message;
  if (status.plan === "trial" && status.trial) {
    return `Prueba gratis: ${status.trial.daysLeft} día(s) o ${status.trial.usesLeft} consulta(s) IA.`;
  }
  if ((status.plan === "subscribed" || status.plan === "courtesy") && status.period) {
    return `Plan activo: ${status.period.remaining} de ${status.period.quota} procesamientos IA.`;
  }
  return "Suscríbase para usar el procesamiento con IA.";
}
