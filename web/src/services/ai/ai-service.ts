export type AiProvider = "deepseek" | "gemini";

const DEFAULT_PROVIDER: AiProvider =
  (import.meta.env.VITE_AI_PROVIDER as AiProvider) || "deepseek";

/** Proxy Vercel (recomendado). Ej: https://tu-proyecto.vercel.app/api/chat */
const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL?.replace(/\/$/, "") || "";

/** Fallback: proxy legacy de website_clinicos (sin systemMessage separado) */
const LEGACY_PROXY =
  import.meta.env.VITE_AI_LEGACY_PROXY?.replace(/\/$/, "") ||
  "https://ceoclinicos-github-io.vercel.app/api/gemini";

export async function sendPrompt(options: {
  prompt: string;
  systemMessage?: string;
  maxTokens?: number;
  provider?: AiProvider;
}): Promise<string> {
  const provider = options.provider ?? DEFAULT_PROVIDER;
  const maxTokens = options.maxTokens ?? 4096;

  if (PROXY_URL) {
    return callProxy(PROXY_URL, options.prompt, options.systemMessage, provider, maxTokens, true);
  }

  try {
    return await callProxy(LEGACY_PROXY, options.prompt, options.systemMessage, provider, maxTokens, false);
  } catch {
    throw new Error(
      "No se pudo conectar a la IA. Configura VITE_AI_PROXY_URL en Vercel o despliega api/chat.js con DEEPSEEK_API_KEY.",
    );
  }
}

async function callProxy(
  baseUrl: string,
  prompt: string,
  systemMessage: string | undefined,
  provider: AiProvider,
  maxTokens: number,
  supportsSystem: boolean,
): Promise<string> {
  const url = baseUrl.includes("/api/") ? baseUrl : `${baseUrl}/api/chat`;
  const body: Record<string, unknown> = supportsSystem
    ? { prompt, systemMessage: systemMessage ?? "", provider, max_tokens: maxTokens }
    : {
        prompt: systemMessage?.trim()
          ? `${systemMessage.trim()}\n\n---\n\n${prompt}`
          : prompt,
        provider,
      };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { text?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Error IA (${res.status})`);
  }
  const text = data.text?.trim();
  if (!text) throw new Error("La IA no devolvió contenido");
  return text;
}

export function getAiProvider(): AiProvider {
  return DEFAULT_PROVIDER;
}
