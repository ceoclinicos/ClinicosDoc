export function isSpeechSupported(): boolean {
  return !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Inicia dictado en español. Devuelve función para detener. */
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

  let base = existingText.trim();
  if (base) base += " ";

  rec.onresult = (ev: SpeechRecognitionEvent) => {
    let interim = "";
    let finalChunk = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finalChunk += t;
      else interim += t;
    }
    if (finalChunk) base += finalChunk + " ";
    onUpdate((base + interim).trim());
  };

  rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
    if (ev.error !== "aborted") {
      onError?.(`Error de dictado: ${ev.error}`);
    }
  };

  try {
    rec.start();
  } catch {
    onError?.("No se pudo iniciar el micrófono");
  }

  return () => {
    try {
      rec.stop();
    } catch {
      /* noop */
    }
  };
}
