/** Dictado web — evita duplicar frases (bug típico de Web Speech API). */

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
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

/**
 * Dictado continuo.
 * Evita duplicados con cursor de resultados finales
 * (Chrome a veces reenvía finales previos).
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
  if (committed) committed += " ";
  let finalizedCount = 0;
  let stopped = false;

  const emit = (interim: string) => {
    onUpdate((committed + interim).replace(/\s+/g, " ").trim());
  };

  rec.onresult = (ev: SpeechRecognitionEvent) => {
    let interim = "";
    for (let i = 0; i < ev.results.length; i++) {
      const result = ev.results[i];
      const piece = (result[0]?.transcript ?? "").trim();
      if (!piece) continue;
      if (result.isFinal) {
        if (i < finalizedCount) continue;
        const already =
          committed.toLowerCase().endsWith(piece.toLowerCase() + " ") ||
          committed.toLowerCase().endsWith(piece.toLowerCase());
        if (!already) committed += piece + " ";
        finalizedCount = i + 1;
      } else if (i >= finalizedCount) {
        interim += (interim ? " " : "") + piece;
      }
    }
    emit(interim);
  };

  rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
    if (ev.error === "aborted" || ev.error === "no-speech") return;
    onError?.(`Error de dictado: ${ev.error}`);
  };

  rec.onend = () => {
    if (stopped) return;
    try {
      finalizedCount = 0;
      rec.start();
    } catch {
      /* ya arrancado */
    }
  };

  try {
    rec.start();
  } catch {
    onError?.("No se pudo iniciar el micrófono");
  }

  return () => {
    stopped = true;
    try {
      rec.onend = () => {};
      rec.stop();
    } catch {
      /* noop */
    }
  };
}
