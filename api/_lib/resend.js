async function sendPinResetEmail(to, nombre, link) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurada en Vercel");

  const from =
    process.env.RESEND_FROM || "Clínicos Doc <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Restablecer PIN — Clínicos Doc",
      html: `
        <p>Hola${nombre ? ` ${nombre}` : ""},</p>
        <p>Recibimos una solicitud para restablecer su PIN en Clínicos Doc.</p>
        <p><a href="${link}">Haga clic aquí para crear un PIN nuevo</a></p>
        <p>El enlace vence en 1 hora. Si no solicitó esto, ignore este correo.</p>
        <p style="color:#666;font-size:12px">clinicosdoc.com</p>
      `,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.message || parsed.error || JSON.stringify(parsed);
    } catch {
      /* usar texto crudo */
    }
    const hint =
      res.status === 403 && from.includes("clinicosdoc.com")
        ? " Verifique el dominio clinicosdoc.com en resend.com/domains (DKIM, SPF, MX)."
        : res.status === 403 && from.includes("resend.dev")
          ? " Con onboarding@resend.dev solo puede enviar a su propio correo de Resend."
          : "";
    throw new Error(`Resend HTTP ${res.status}: ${detail}${hint}`);
  }
}

module.exports = { sendPinResetEmail };
