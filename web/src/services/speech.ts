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
  // Evitar "palabra palabra" al final
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
 * Dictado continuo sin repetir frases.
 * Usa resultIndex + join anti-duplicado; al reiniciar tras silencio no re-anexa texto viejo.
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
  let restarting = false;

  const emit = () => {
    onUpdate(joinText(committed, sessionPartial));
  };

  if (committed) onUpdate(committed);

  rec.onresult = (ev: SpeechRecognitionEvent) => {
    let interim = "";
    // Solo resultados nuevos desde resultIndex (evita re-procesar finales viejos)
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
    if (ev.error === "aborted" || ev.error === "no-speech") return;
    if (ev.error === "network" || ev.error === "audio-capture") {
      onError?.(`Error de dictado: ${ev.error}`);
    }
  };

  rec.onend = () => {
    if (stopped) return;
    // Reinicio limpio: no resetear committed; sí limpiar parcial
    sessionPartial = "";
    restarting = true;
    window.setTimeout(() => {
      if (stopped) return;
      try {
        rec.start();
      } catch {
        /* ya arrancado */
      }
      restarting = false;
    }, 200);
  };

  try {
    rec.start();
  } catch {
    onError?.("No se pudo iniciar el micrófono");
  }

  return () => {
    stopped = true;
    try {
      rec.onend = null;
      rec.onresult = null;
      if (typeof rec.abort === "function") rec.abort();
      else rec.stop();
    } catch {
      /* noop */
    }
    void restarting;
  };
}
