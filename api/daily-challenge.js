const { randomBytes, createHash } = require("node:crypto");
const { getAdmin } = require("./_lib/firebase");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { banks, dailyChallenge, gradeAnswers } = require("./_lib/daily-challenge-data");

const hash = value => createHash("sha256").update(value).digest("hex");

function createHandler(getDb = () => getAdmin().firestore(), clock = () => new Date()) {
  return async (req, res) => {
    applyCors(res);
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") return res.status(204).end();
    if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Método no permitido" });
    try {
      const today = dailyChallenge(clock());
      const db = getDb();
      const participants = db.collection("clinicos_daily_results").doc(today.date).collection("participants");
      if (req.method === "GET") {
        const rows = await participants.orderBy("finishedAt", "desc").limit(10).get();
        return res.status(200).json({
          date: today.date,
          bankNumber: today.bankNumber,
          title: today.bank.title,
          questions: today.bank.questions.map(q => ({ question: q[0], options: q[1] })),
          participants: rows.docs.map(doc => {
            const row = doc.data();
            return { name: row.name, score: row.score, finishedAt: row.finishedAt.toDate().toISOString() };
          }),
        });
      }
      const body = parseBody(req);
      if (body.action === "start") {
        if (body.date !== today.date) return res.status(409).json({ error: "El reto cambió de día. Actualiza la página." });
        if (body.name != null && typeof body.name !== "string") return res.status(400).json({ error: "Nombre inválido" });
        const name = (body.name || "").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim() || "Anónimo";
        if (Array.from(name).length > 30) return res.status(400).json({ error: "El nombre admite hasta 30 caracteres." });
        const token = randomBytes(32).toString("hex");
        const session = db.collection("clinicos_daily_sessions").doc(hash(token));
        const ip = req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
        const rate = db.collection("clinicos_daily_limits").doc(hash(`${today.date}:${String(ip).split(",")[0].trim()}`));
        const allowed = await db.runTransaction(async tx => {
          const rateSnap = await tx.get(rate);
          const count = rateSnap.exists ? rateSnap.data().count : 0;
          if (count >= 20) return false;
          tx.set(rate, { count: count + 1, expiresAt: new Date(clock().getTime() + 86400000) });
          tx.set(session, {
            date: today.date, bankId: today.bank.id, name, finished: false,
            expiresAt: new Date(clock().getTime() + 60 * 60 * 1000),
          });
          return true;
        });
        if (!allowed) return res.status(429).json({ error: "Demasiados intentos desde esta conexión. Vuelve mañana." });
        return res.status(200).json({ token });
      }
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) {
        return res.status(400).json({ error: "Solicitud inválida" });
      }
      const sessionRefEarly = db.collection("clinicos_daily_sessions").doc(hash(body.token));
      if (body.action === "answer") {
        if (!Number.isInteger(body.index) || body.index < 0 || body.index > 2
          || !Number.isInteger(body.answer) || body.answer < 0 || body.answer > 3) {
          return res.status(400).json({ error: "Solicitud inválida" });
        }
        const graded = await db.runTransaction(async tx => {
          const snap = await tx.get(sessionRefEarly);
          if (!snap.exists) return { status: 401, error: "Inicia el reto antes de responder." };
          const session = snap.data();
          const bank = banks.find(item => item.id === session.bankId);
          if (!bank) return { status: 410, error: "Este reto ya no está disponible." };
          if (session.finished) return { status: 410, error: "El reto ya terminó." };
          if (session.expiresAt.toDate().getTime() <= clock().getTime()) {
            return { status: 410, error: "El intento venció. Vuelve al inicio para comenzar de nuevo." };
          }
          const answers = Array.isArray(session.answers) ? session.answers.slice() : [];
          answers[body.index] = body.answer;
          tx.update(sessionRefEarly, { answers });
          const q = bank.questions[body.index];
          return { status: 200, correct: q[2] === body.answer, correctAnswer: q[2], explanation: q[3] };
        });
        const { status, ...payload } = graded;
        return res.status(status).json(payload);
      }
      if (body.action !== "submit") {
        return res.status(400).json({ error: "Solicitud inválida" });
      }
      if (!Array.isArray(body.answers) || body.answers.length !== 3 || body.answers.some(a => !Number.isInteger(a) || a < 0 || a > 3)) {
        return res.status(400).json({ error: "Responde las tres preguntas." });
      }
      const sessionRef = db.collection("clinicos_daily_sessions").doc(hash(body.token));
      const result = await db.runTransaction(async tx => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists) return { status: 401, error: "Inicia el reto antes de enviar respuestas." };
        const session = snap.data();
        const bank = banks.find(bank => bank.id === session.bankId);
        if (!bank) return { status: 410, error: "Este reto ya no está disponible." };
        if (session.finished) return { status: 200, ...gradeAnswers(bank, session.answers), name: session.name, date: session.date };
        if (session.expiresAt.toDate().getTime() <= clock().getTime()) return { status: 410, error: "El intento venció. Vuelve al inicio para comenzar de nuevo." };
        const graded = gradeAnswers(bank, body.answers);
        const ref = db.collection("clinicos_daily_results").doc(session.date).collection("participants").doc(sessionRef.id);
        tx.set(ref, { name: session.name, score: graded.score, finishedAt: clock() });
        tx.update(sessionRef, { finished: true, answers: body.answers });
        return { status: 200, ...graded, name: session.name, date: session.date };
      });
      const { status, ...payload } = result;
      return res.status(status).json(payload);
    } catch (error) {
      console.error("daily-challenge:", error.code || error.name || "Error");
      return res.status(503).json({ error: "El reto no está disponible en este momento. Intenta nuevamente." });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
