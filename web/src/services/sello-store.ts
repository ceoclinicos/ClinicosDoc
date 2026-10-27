/** Sello médico del doctor: imagen global (no por encabezado) — paridad SelloStorage app. */
import { setDoc, doc, getDoc } from "firebase/firestore";
import { getDb } from "../registro/firebase";
import { getProfessionalSession } from "../registro/session";
import { FirestorePaths } from "../shared/models";
import { loadJson, saveJson } from "./local-store";
import { fileToLogoBase64 } from "./header-logo";
import { canSync, syncQuiet } from "./cloud-sync";

const KEY = "sello_medico";
export const SELLO_MIN_SIDE = 128;

export interface SelloData {
  base64: string;
}

export function loadSello(): SelloData | null {
  return loadJson<SelloData | null>(KEY, null);
}

export function hasSello(): boolean {
  return Boolean(loadSello()?.base64);
}

export async function saveSello(file: File): Promise<SelloData> {
  const base64 = await fileToLogoBase64(file, SELLO_MIN_SIDE, false);
  const data: SelloData = { base64 };
  saveJson(KEY, data);
  if (canSync()) syncQuiet(() => pushSelloCloud(base64));
  return data;
}

export function clearSello(): void {
  saveJson(KEY, null);
  if (canSync()) syncQuiet(() => pushSelloCloud(null));
}

/** El sello viaja en el doc del usuario (`clinicosdoc_user/{uid}.selloBase64`), como en la app. */
export async function pushSelloCloud(base64: string | null): Promise<void> {
  const userId = getProfessionalSession()?.cloudUserId;
  if (!userId) return;
  await setDoc(
    doc(getDb(), FirestorePaths.USERS, userId),
    { selloBase64: base64 ?? null },
    { merge: true },
  );
}

/** Pull al iniciar sesión: la nube manda; si no hay sello en nube, se sube el local. */
export async function syncSelloOnLogin(): Promise<void> {
  const userId = getProfessionalSession()?.cloudUserId;
  if (!userId) return;
  const snap = await getDoc(doc(getDb(), FirestorePaths.USERS, userId));
  const remote = snap.exists() ? (snap.data().selloBase64 as string | null | undefined) : undefined;
  const local = loadSello();
  if (remote) {
    if (remote !== local?.base64) saveJson(KEY, { base64: remote });
  } else if (remote === null) {
    if (local) saveJson(KEY, null);
  } else if (local) {
    await pushSelloCloud(local.base64);
  }
}

export function selloDataUrl(base64?: string | null): string | undefined {
  if (!base64) return undefined;
  if (base64.startsWith("data:")) return base64;
  return `data:image/jpeg;base64,${base64}`;
}
