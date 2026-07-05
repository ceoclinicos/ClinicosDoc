import { loadJson, saveJson } from "./local-store";
import type { DoctorInfo } from "./ai/document-ai-service";

const KEY = "doctor_profile";

export interface DoctorProfileLocal extends DoctorInfo {
  cedula: string;
  mpps: string;
}

export function loadDoctorProfile(): DoctorProfileLocal | null {
  return loadJson<DoctorProfileLocal | null>(KEY, null);
}

export function saveDoctorProfile(profile: DoctorProfileLocal): void {
  saveJson(KEY, profile);
}
