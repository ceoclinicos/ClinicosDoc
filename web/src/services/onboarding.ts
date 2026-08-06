import { loadJson, saveJson } from "./local-store";

const REDACTAR_TUTORIAL_KEY = "onboarding_redactar_v1_seen";

export function hasSeenRedactarTutorial(): boolean {
  return loadJson<boolean>(REDACTAR_TUTORIAL_KEY, false);
}

export function markRedactarTutorialSeen(): void {
  saveJson(REDACTAR_TUTORIAL_KEY, true);
}

export function resetRedactarTutorial(): void {
  saveJson(REDACTAR_TUTORIAL_KEY, false);
}
