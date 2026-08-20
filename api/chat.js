const { getAdmin } = require("./_lib/firebase");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");
const { requireAppAuth } = require("./_lib/require-app-auth");

const MAX_PROMPT_CHARS = 48_000;
const MAX_OUTPUT_TOKENS = 8192;

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    await requireAppAuth(req, getAdmin());

    const body = parseBody(req);
    const prompt = String(body.prompt || "");
    const systemMessage = String(body.systemMessage || "");
    const provider = String(body.provider || "deepseek").toLowerCase();
    const maxTokens = Math.min(
      MAX_OUTPUT_TOKENS,
      Math.max(1, Number(body.max_tokens || body.maxTokens || 4096) || 4096),
    );

    if (!prompt.trim()) return res.status(400).json({ error: "Falta el prompt" });
    if (prompt.length > MAX_PROMPT_CHARS) {
      return res.status(400).json({ error: "Prompt demasiado largo" });
    }

    let text;

    if (provider === "deepseek") {
      const dsKey = process.env.DEEPSEEK_API_KEY;
      if (!dsKey) return res.status(500).json({ error: "DEEPSEEK_API_KEY no configurada en Vercel" });

      const messages = [];
      if (systemMessage.trim()) {
        messages.push({ role: "system", content: systemMessage.trim() });
      }
      messages.push({ role: "user", content: prompt });

      const dsResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + dsKey,
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages,
          temperature: 0.7,
          max_tokens: maxTokens,
          thinking: { type: "disabled" },
        }),
      });

      const dsData = await dsResponse.json();
      if (!dsResponse.ok) {
        const dsErr =
          (dsData.error && (dsData.error.message || dsData.error)) || "Error de DeepSeek API";
        return res.status(dsResponse.status).json({ error: dsErr });
      }

      text = dsData.choices?.[0]?.message?.content;
    } else if (provider === "gemini") {
      const gmKey = process.env.GEMINI_API_KEY;
      if (!gmKey) return res.status(500).json({ error: "GEMINI_API_KEY no configurada en Vercel" });

      const gmUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        gmKey;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      };
      if (systemMessage.trim()) {
        payload.systemInstruction = { parts: [{ text: systemMessage.trim() }] };
      }

      const gmResponse = await fetch(gmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const gmData = await gmResponse.json();
      if (!gmResponse.ok) {
        const gmErr = (gmData.error && gmData.error.message) || "Error de Gemini API";
        return res.status(gmResponse.status).json({ error: gmErr });
      }

      text = gmData.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      return res.status(400).json({ error: "Proveedor no válido" });
    }

    if (!text) return res.status(500).json({ error: "Respuesta vacía de la IA" });
    return res.status(200).json({ text });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No autorizado" });
    }
    console.error("chat", err);
    return apiError(res, 500, "Error del servidor de IA", err?.message || String(err), "CHAT_FAILED");
  }
};
