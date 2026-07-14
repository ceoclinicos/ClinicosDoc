async function sendPinResetEmail(to, nombre, link, secretKind = "pin") {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurada en Vercel");

  const from =
    process.env.RESEND_FROM || "Clínicos Doc <noreply@clinicosdoc.com>";

  if (from.includes("resend.dev")) {
    throw new Error(
      "RESEND_FROM no puede ser onboarding@resend.dev en producción. " +
        "Use: Clínicos Doc <noreply@clinicosdoc.com> (dominio verificado en resend.com/domains).",
    );
  }

  const isPassword = secretKind === "password";
  const subject = isPassword
    ? "Restablecer contraseña — Clínicos Doc"
    : "Restablecer PIN — Clínicos Doc";
  const accion = isPassword ? "contraseña" : "PIN";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `
        <p>Hola${nombre ? ` ${nombre}` : ""},</p>
        <p>Recibimos una solicitud para restablecer su ${accion} en Clínicos Doc.</p>
        <p><a href="${link}">Haga clic aquí para crear un ${accion} nuevo</a></p>
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
      res.status === 403
        ? " En resend.com/domains verifique que clinicosdoc.com esté en verde. " +
          "En Vercel agregue RESEND_FROM = Clínicos Doc <noreply@clinicosdoc.com>"
        : "";
    throw new Error(`Resend HTTP ${res.status}: ${detail}${hint}`);
  }
}

module.exports = { sendPinResetEmail };
