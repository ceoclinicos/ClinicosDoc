module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const body = req.body || {};
  const prompt = body.prompt;
  const systemMessage = body.systemMessage || "";
  const provider = body.provider || "deepseek";
  const maxTokens = body.max_tokens || body.maxTokens || 4096;

  if (!prompt) return res.status(400).json({ error: "Falta el prompt" });

  try {
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
          model: "deepseek-chat",
          messages,
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      });

      const dsData = await dsResponse.json();
      if (!dsResponse.ok) {
        const dsErr =
          (dsData.error && (dsData.error.message || dsData.error)) || "Error de DeepSeek API";
        return res.status(dsResponse.status).json({ error: dsErr });
      }

      text = dsData.choices?.[0]?.message?.content;
    } else {
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
    }

    if (!text) return res.status(500).json({ error: "Respuesta vacía de la IA" });
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error del servidor" });
  }
};
