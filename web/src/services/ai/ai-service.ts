import { getIdToken } from "../firebase-auth";

export type AiProvider = "deepseek" | "gemini";

const DEFAULT_PROVIDER: AiProvider =
  (import.meta.env.VITE_AI_PROVIDER as AiProvider) || "deepseek";

/** Proxy Vercel protegido (requiere sesión Firebase). */
const PROXY_URL =
  import.meta.env.VITE_AI_PROXY_URL?.replace(/\/$/, "") ||
  "https://clinicos-doc.vercel.app/api/chat";

export async function sendPrompt(options: {
  prompt: string;
  systemMessage?: string;
  maxTokens?: number;
  provider?: AiProvider;
}): Promise<string> {
  const provider = options.provider ?? DEFAULT_PROVIDER;
  const maxTokens = options.maxTokens ?? 4096;
  const token = await getIdToken();
  if (!token) {
    throw new Error("Inicie sesión para usar la IA.");
  }

  const url = PROXY_URL.includes("/api/") ? PROXY_URL : `${PROXY_URL}/api/chat`;
  const body = {
    prompt: options.prompt,
    systemMessage: options.systemMessage ?? "",
    provider,
    max_tokens: maxTokens,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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
