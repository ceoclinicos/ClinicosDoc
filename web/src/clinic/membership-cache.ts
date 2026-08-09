import { applyMembershipSnapshot, loadMembershipSnapshot } from "./affiliation-notices";
import { listMembershipsForDoctor } from "./store";

export type CachedMembership = {
  clinicId: string;
  clinicName: string;
  role: string;
};

let memory: CachedMembership[] | null = null;
let inflight: Promise<CachedMembership[]> | null = null;

function fromSnapshot(): CachedMembership[] {
  return loadMembershipSnapshot().map((m) => ({
    clinicId: m.clinicId,
    clinicName: m.clinicName,
    role: "medico",
  }));
}

/** Lectura síncrona (memoria o localStorage). */
export function getCachedMemberships(): CachedMembership[] {
  if (memory) return memory;
  return fromSnapshot();
}

export function setCachedMemberships(list: CachedMembership[]): void {
  memory = list;
  applyMembershipSnapshot(list.map((m) => ({ clinicId: m.clinicId, clinicName: m.clinicName })));
}

/**
 * Precarga / refresca afiliaciones. Si hay caché, la devuelve al instante y
 * opcionalmente refresca en segundo plano.
 */
export async function ensureMembershipsLoaded(
  doctorCedula: string,
  cloudUserId?: string,
  opts?: { force?: boolean; backgroundRefresh?: boolean },
): Promise<CachedMembership[]> {
  const force = Boolean(opts?.force);
  const cached = getCachedMemberships();

  if (!force && cached.length) {
    if (opts?.backgroundRefresh !== false && doctorCedula) {
      void refreshMembershipsQuiet(doctorCedula, cloudUserId);
    }
    return cached;
  }

  if (!doctorCedula) return cached;

  if (!force && inflight) return inflight;

  const job = (async () => {
    try {
      const list = await listMembershipsForDoctor(doctorCedula, cloudUserId, {
        forceHeal: force,
      });
      const mapped = list.map((m) => ({
        clinicId: m.clinicId,
        clinicName: m.clinicName,
        role: m.role || "medico",
      }));
      // No pisar caché buena con vacío (salvo force)
      if (mapped.length || force || !cached.length) {
        setCachedMemberships(mapped);
        return mapped;
      }
      return cached;
    } catch {
      return cached;
    } finally {
      inflight = null;
    }
  })();

  if (!force) inflight = job;
  return job;
}

async function refreshMembershipsQuiet(
  doctorCedula: string,
  cloudUserId?: string,
): Promise<void> {
  try {
    const list = await listMembershipsForDoctor(doctorCedula, cloudUserId);
    if (list.length) {
      setCachedMemberships(
        list.map((m) => ({
          clinicId: m.clinicId,
          clinicName: m.clinicName,
          role: m.role || "medico",
        })),
      );
    }
  } catch {
    /* silencioso */
  }
}
