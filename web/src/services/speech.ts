/** Dictado web — paridad anti-duplicado con SpeechService de la app. */

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
};

type SpeechRecognitionCtor = new () => Rec;

export function isSpeechSupported(): boolean {
  return !!(
    window.SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Une base + nuevo texto evitando repeticiones (misma idea que la app). */
function joinText(base: string, addition: string): string {
  const left = base.trimEnd();
  const right = addition.trim();
  if (!left) return right;
  if (!right) return left;
  const leftL = left.toLowerCase();
  const rightL = right.toLowerCase();
  if (rightL.startsWith(leftL)) return right;
  if (leftL.endsWith(rightL)) return left;
  const lastWords = leftL.split(/\s+/).slice(-8).join(" ");
  if (lastWords && rightL.startsWith(lastWords)) {
    return left + right.slice(lastWords.length);
  }
  const leftWords = leftL.split(/\s+/);
  const rightWords = rightL.split(/\s+/);
  for (let n = Math.min(leftWords.length, rightWords.length, 6); n >= 1; n--) {
    const suffix = leftWords.slice(-n).join(" ");
    const prefix = rightWords.slice(0, n).join(" ");
    if (suffix === prefix) {
      const trimmedRight = right.split(/\s+/).slice(n).join(" ");
      return trimmedRight ? `${left} ${trimmedRight}` : left;
    }
  }
  return `${left} ${right}`;
}

/**
 * Dictado continuo hasta que el caller invoque el stop.
 * Solo se detiene con Detener o Procesar con IA (el caller llama al dispose).
 */
export function startDictation(
  existingText: string,
  onUpdate: (text: string) => void,
  onError?: (message: string) => void,
): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    onError?.("Dictado no disponible en este navegador. Use Chrome o Edge.");
    return () => {};
  }

  const rec = new Ctor();
  rec.lang = "es-VE";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let committed = existingText.trim();
  let sessionPartial = "";
  let stopped = false;
  let restartTimer: number | null = null;

  const clearRestart = () => {
    if (restartTimer != null) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const emit = () => {
    onUpdate(joinText(committed, sessionPartial));
  };

  const kickStart = () => {
    if (stopped) return;
    try {
      rec.start();
    } catch {
      // Ya activo o aún cerrando: reintentar
      clearRestart();
      restartTimer = window.setTimeout(() => {
        restartTimer = null;
        if (stopped) return;
        try {
          rec.start();
        } catch {
          /* noop */
        }
      }, 180);
    }
  };

  const scheduleRestart = (ms = 50) => {
    if (stopped) return;
    clearRestart();
    sessionPartial = "";
    restartTimer = window.setTimeout(() => {
      restartTimer = null;
      kickStart();
    }, ms);
  };

  if (committed) onUpdate(committed);

  rec.onresult = (ev: SpeechRecognitionEvent) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const result = ev.results[i];
      const piece = (result[0]?.transcript ?? "").trim();
      if (!piece) continue;
      if (result.isFinal) {
        committed = joinText(committed, piece);
        sessionPartial = "";
      } else {
        interim = interim ? `${interim} ${piece}` : piece;
      }
    }
    sessionPartial = interim;
    emit();
  };

  rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
    if (stopped) return;
    // Errores recuperables: no parar UI; onend o este schedule reinician
    if (
      ev.error === "aborted" ||
      ev.error === "no-speech" ||
      ev.error === "network" ||
      ev.error === "audio-capture"
    ) {
      scheduleRestart(80);
      return;
    }
    if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
      onError?.("Permiso de micrófono denegado");
      stopped = true;
      clearRestart();
      return;
    }
  };

  rec.onend = () => {
    if (stopped) return;
    // El navegador corta tras pausas; reiniciar siempre
    scheduleRestart(40);
  };

  kickStart();

  return () => {
    stopped = true;
    clearRestart();
    try {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      if (typeof rec.abort === "function") rec.abort();
      else rec.stop();
    } catch {
      /* noop */
    }
  };
}
