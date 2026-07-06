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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

module.exports = { sendPinResetEmail };
