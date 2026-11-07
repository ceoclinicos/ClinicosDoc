const { test } = require("node:test");
const assert = require("node:assert/strict");
const { banks, dailyChallenge, gradeAnswers } = require("../api/_lib/daily-challenge-data");
const { createHandler } = require("../api/daily-challenge");

test("15 bancos de tres preguntas válidas y respuestas con índices cero", () => {
  assert.equal(banks.length, 15);
  assert.equal(new Set(banks.map(b => b.id)).size, 15);
  for (const bank of banks) {
    assert.equal(bank.questions.length, 3);
    for (const [question, options, answer, explanation] of bank.questions) {
      assert.ok(question && explanation);
      assert.equal(options.length, 4);
      assert.equal(new Set(options).size, 4);
      assert.ok(Number.isInteger(answer) && answer >= 0 && answer <= 3);
    }
    assert.equal(gradeAnswers(bank, bank.questions.map(q => q[2])).score, 3);
    assert.equal(gradeAnswers(bank, bank.questions.map(q => (q[2] + 1) % 4)).score, 0);
  }
});

test("el banco cambia a medianoche venezolana y se repite cada 15 días", () => {
  const first = dailyChallenge(new Date("2026-11-06T04:00:00Z"));
  assert.equal(first.date, "2026-11-06");
  assert.equal(first.bankNumber, 1);
  assert.equal(dailyChallenge(new Date("2026-11-07T03:59:59Z")).bank.id, first.bank.id);
  assert.equal(dailyChallenge(new Date("2026-11-07T04:00:00Z")).bankNumber, 2);
  assert.equal(dailyChallenge(new Date("2026-11-20T04:00:00Z")).bankNumber, 15);
  assert.equal(dailyChallenge(new Date("2026-11-21T04:00:00Z")).bank.id, first.bank.id);
});

test("rechaza respuestas incompletas, fraccionarias o fuera de rango", () => {
  for (const answers of [null, [], [0, 1], [0, 1, 4], [0, -1, 2], [0, 1.5, 2], ["0", 1, 2]]) {
    assert.throws(() => gradeAnswers(banks[0], answers));
  }
});

function memoryDb() {
  const records = new Map();
  const timestamp = data => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value instanceof Date ? { toDate: () => value } : value]));
  const snapshot = ref => ({ exists: records.has(ref.path), data: () => records.get(ref.path) });
  const collection = path => ({
    doc: id => ({ path: `${path}/${id}`, id, collection: name => collection(`${path}/${id}/${name}`) }),
    orderBy: () => ({ limit: count => ({ get: async () => ({ docs: [...records].filter(([key]) => key.startsWith(`${path}/`)).slice(0, count).map(([, value]) => ({ data: () => value })) }) }) }),
  });
  return {
    records,
    collection,
    runTransaction: async callback => callback({
      get: async ref => snapshot(ref),
      set: (ref, value) => records.set(ref.path, timestamp(value)),
      update: (ref, value) => records.set(ref.path, { ...records.get(ref.path), ...timestamp(value) }),
    }),
  };
}

function invoke(handler, method, body = {}, headers = {}) {
  const response = { code: 200, payload: undefined, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; },
  };
  return handler({ method, body, headers, socket: { remoteAddress: "127.0.0.1" } }, response).then(() => response);
}

test("jugar como anónimo, cálculo servidor, reintento idempotente y lista pública sin token", async () => {
  const db = memoryDb();
  const handler = createHandler(() => db, () => new Date("2026-11-06T12:00:00Z"));
  const initial = await invoke(handler, "GET");
  assert.equal(initial.code, 200);
  assert.equal(initial.payload.questions.length, 3);
  assert.ok(!JSON.stringify(initial.payload).includes("correctAnswer"));
  const started = await invoke(handler, "POST", { action: "start", date: initial.payload.date });
  const token = started.payload.token;
  assert.match(token, /^[a-f0-9]{64}$/);
  const answers = banks[0].questions.map(q => q[2]);
  const result = await invoke(handler, "POST", { action: "submit", token, answers, score: 0 });
  assert.equal(result.payload.score, 3);
  assert.equal(result.payload.name, "Anónimo");
  const retry = await invoke(handler, "POST", { action: "submit", token, answers: [0, 0, 0] });
  assert.deepEqual(retry.payload, result.payload);
  const list = await invoke(handler, "GET");
  assert.equal(list.payload.participants.length, 1);
  assert.deepEqual(Object.keys(list.payload.participants[0]).sort(), ["finishedAt", "name", "score"]);
});

test("sesiones vencidas, fecha vieja, tokens inválidos y límite de intentos", async () => {
  let now = new Date("2026-11-06T12:00:00Z");
  const db = memoryDb();
  const handler = createHandler(() => db, () => now);
  assert.equal((await invoke(handler, "POST", { action: "start", date: "2026-11-05" })).code, 409);
  assert.equal((await invoke(handler, "POST", { action: "submit", token: "bad", answers: [0, 1, 2] })).code, 400);
  assert.equal((await invoke(handler, "POST", { action: "start", date: "2026-11-06", name: "x".repeat(31) })).code, 400);
  const first = await invoke(handler, "POST", { action: "start", date: "2026-11-06", name: "Ana" });
  for (let i = 1; i < 20; i++) assert.equal((await invoke(handler, "POST", { action: "start", date: "2026-11-06" })).code, 200);
  assert.equal((await invoke(handler, "POST", { action: "start", date: "2026-11-06" })).code, 429);
  now = new Date("2026-11-06T14:00:00Z");
  assert.equal((await invoke(handler, "POST", { action: "submit", token: first.payload.token, answers: [0, 1, 2] })).code, 410);
});

test("un resultado guardado se recupera aunque la sesión haya vencido", async () => {
  let now = new Date("2026-11-06T12:00:00Z");
  const db = memoryDb();
  const handler = createHandler(() => db, () => now);
  const start = await invoke(handler, "POST", { action: "start", date: "2026-11-06" });
  const body = { action: "submit", token: start.payload.token, answers: banks[0].questions.map(q => q[2]) };
  const original = await invoke(handler, "POST", body);
  now = new Date("2026-11-06T14:00:00Z");
  const recovered = await invoke(handler, "POST", body);
  assert.equal(recovered.code, 200);
  assert.deepEqual(recovered.payload, original.payload);
});

test("un intento que cruza medianoche conserva su banco original", async () => {
  let now = new Date("2026-11-07T03:59:00Z");
  const db = memoryDb();
  const handler = createHandler(() => db, () => now);
  const started = await invoke(handler, "POST", { action: "start", date: "2026-11-06", name: "  Ana  " });
  now = new Date("2026-11-07T04:01:00Z");
  const finished = await invoke(handler, "POST", {
    action: "submit", token: started.payload.token, answers: banks[0].questions.map(q => q[2]),
  });
  assert.equal(finished.code, 200);
  assert.equal(finished.payload.score, 3);
  assert.equal(finished.payload.date, "2026-11-06");
  assert.equal(finished.payload.name, "Ana");
  const today = await invoke(handler, "GET");
  assert.equal(today.payload.bankNumber, 2);
  assert.equal(today.payload.participants.length, 0);
});

test("fallo de Firebase no publica secretos ni resultados falsos", async () => {
  const handler = createHandler(() => { throw new Error("sensitive configuration"); });
  const response = await invoke(handler, "GET");
  assert.equal(response.code, 503);
  assert.ok(!JSON.stringify(response.payload).includes("sensitive"));
  assert.equal((await invoke(handler, "DELETE")).code, 405);
  assert.equal((await invoke(handler, "OPTIONS")).code, 204);
});
