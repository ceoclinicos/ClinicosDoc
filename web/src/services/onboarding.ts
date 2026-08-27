import { loadJson, saveJson } from "./local-store";

const REDACTAR_TUTORIAL_KEY = "onboarding_redactar_v1_seen";
const TUTORIAL_BTN_KEY = "tutorial_button_enabled_v1";

export function hasSeenRedactarTutorial(): boolean {
  return loadJson<boolean>(REDACTAR_TUTORIAL_KEY, false);
}

export function markRedactarTutorialSeen(): void {
  saveJson(REDACTAR_TUTORIAL_KEY, true);
}

export function resetRedactarTutorial(): void {
  saveJson(REDACTAR_TUTORIAL_KEY, false);
}

/** Botón de tutorial oculto por defecto; se activa con 6× Inicio. */
export function isTutorialButtonEnabled(): boolean {
  return loadJson<boolean>(TUTORIAL_BTN_KEY, false);
}

export function setTutorialButtonEnabled(enabled: boolean): void {
  saveJson(TUTORIAL_BTN_KEY, enabled);
  window.dispatchEvent(new CustomEvent("tutorialbtnchange", { detail: { enabled } }));
}
