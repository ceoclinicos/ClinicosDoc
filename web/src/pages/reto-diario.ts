import { registerRoute } from "../app/router";
import "../styles/reto-diario.css";

type Question = { question: string; options: string[] };
type Participant = { name: string; score: number; finishedAt: string };
type Challenge = { date: string; bankNumber: number; title: string; questions: Question[]; participants: Participant[] };
type Result = { score: number; name: string; date: string; review: { correctAnswer: number; explanation: string }[] };
type AnswerFeedback = { correct: boolean; correctAnswer: number; explanation: string };
type Attempt = { date: string; token: string; answers: number[] };
const API = `${(import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(/\/$/, "")}/api/daily-challenge`;
const STORE = "clinicos-daily-attempt-v1";
const PLAY = "https://play.google.com/store/apps/details?id=com.ceoclinicos";

class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(body?: object): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new RequestError(data?.error || "No se pudo cargar el reto. Intenta de nuevo más tarde.", response.status);
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw new RequestError("La conexión tardó demasiado. Reintenta sin cerrar la página.", 408);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = value;
  el.className = className;
  return el;
}

function relativeDate(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (!Number.isFinite(minutes)) return "Hoy";
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  return `Hace ${Math.floor(minutes / 60)} h`;
}

function loadAttempt(date: string): Attempt | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) || "null") as Attempt | null;
    if (value?.date === date && /^[a-f0-9]{64}$/.test(value.token) && Array.isArray(value.answers)
      && value.answers.length <= 3 && value.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 3)) return value;
  } catch { return undefined; }
  return undefined;
}

function render(): HTMLElement {
  const root = document.createElement("section");
  root.className = "daily-challenge page";
  root.innerHTML = `
    <header class="daily-hero">
      <div class="daily-hero-mark"><img src="/img/clinicos-logo.jpg" alt=""><span>CLÍNICOS</span></div>
      <span class="daily-eyebrow">CLÍNICOS · RETO DIARIO</span>
      <h1>Tres preguntas.<br>¿Aceptas el reto?</h1>
      <p>Un pequeño repaso, una nueva oportunidad cada día. Juega gratis, sin instalar ni registrarte.</p>
      <div class="daily-tags"><span>3 preguntas</span><span>Nivel inicial</span><span>Sin registro</span></div>
    </header>
    <div class="daily-body">
      <div class="daily-game" aria-live="polite"></div>
      <p class="daily-notice" role="status"></p>
      <section class="daily-community" aria-label="Participaciones del día">
        <div class="daily-community-heading"><h2>Ya aceptaron el reto</h2><button type="button" class="btn btn-secondary daily-refresh">Actualizar</button></div>
        <p class="daily-community-note">Últimas 10 participaciones de hoy. Sin respuestas ni desempates por tiempo.</p>
        <ul class="daily-people" aria-live="polite"></ul>
      </section>
      <footer class="daily-footer"><p>¿Quieres seguir practicando?</p><a class="btn btn-primary" href="${PLAY}" target="_blank" rel="noopener noreferrer">Descargar Clínicos en Google Play</a><p>Contenido educativo. No sustituye una valoración médica.</p></footer>
    </div>`;
  const game = root.querySelector<HTMLDivElement>(".daily-game")!;
  const notice = root.querySelector<HTMLParagraphElement>(".daily-notice")!;
  const people = root.querySelector<HTMLUListElement>(".daily-people")!;
  const refresh = root.querySelector<HTMLButtonElement>(".daily-refresh")!;
  let challenge: Challenge;
  let attempt: Attempt | undefined;
  let submitting = false;

  function saveAttempt() {
    try { localStorage.setItem(STORE, JSON.stringify(attempt)); } catch {}
  }

  function showPeople(rows: Participant[]) {
    people.replaceChildren();
    if (!rows.length) {
      people.append(text("li", "Sé la primera persona en completar el reto de hoy.", "daily-empty"));
      return;
    }
    for (const row of rows) {
      const li = document.createElement("li");
      const avatar = text("span", (row.name || "A").slice(0, 1).toLocaleUpperCase(), "daily-avatar");
      avatar.setAttribute("aria-hidden", "true");
      const name = document.createElement("div");
      name.append(text("strong", row.name || "Anónimo"), text("small", relativeDate(row.finishedAt)));
      li.append(avatar, name, text("span", `${row.score}/3`, "daily-person-score"));
      people.append(li);
    }
  }

  async function updatePeople() {
    refresh.disabled = true;
    try {
      const latest = await request<Challenge>();
      if (latest.date !== challenge.date) {
        notice.textContent = "Comenzó un nuevo día. Recarga la página para ver el nuevo reto.";
        return;
      }
      showPeople(latest.participants);
    } catch {
      notice.textContent = "No se pudo actualizar la lista. Tu partida no se ha perdido.";
    } finally { refresh.disabled = false; }
  }
  refresh.addEventListener("click", () => void updatePeople());

  function resultView(result: Result) {
    game.replaceChildren();
    const score = text("div", `${result.score}/3`, "daily-big-score");
    const heading = text("h2", result.score === 3 ? "¡Reto completado, pleno de aciertos!" : "¡Reto completado! Cada pregunta cuenta.");
    game.append(score, heading, text("p", `${result.name}, este fue tu repaso de hoy. Vuelve mañana para descubrir otro banco.`));

    game.append(text("h3", "Tus resultados"));
    const answers = attempt?.answers || [];
    challenge.questions.forEach((q, i) => {
      const review = document.createElement("article");
      review.className = "daily-review";
      const correct = result.review[i];
      const mine = answers[i];
      const hit = mine === correct.correctAnswer;
      review.append(
        text("h4", `${hit ? "✓" : "✗"} ${i + 1}. ${q.question}`),
        text("p", `Tu respuesta: ${mine != null ? q.options[mine] : "—"}`, hit ? "daily-correct" : "daily-wrong"),
        text("p", `Respuesta correcta: ${q.options[correct.correctAnswer]}`, "daily-correct"),
        text("p", correct.explanation),
      );
      game.append(review);
    });

    const link = new URL(window.location.href);
    link.hash = `/reto-diario?dia=${result.date}`;
    const message = `Acerté ${result.score}/3 en el reto médico de Clínicos. ¿Me superas? Juega gratis: ${link.href}`;

    const shareBlock = document.createElement("section");
    shareBlock.className = "daily-share";
    const logo = document.createElement("img");
    logo.src = "/img/clinicos-logo.jpg";
    logo.alt = "Clínicos";
    logo.className = "daily-share-logo";
    shareBlock.append(logo, text("p", "COMPARTIR RETO", "daily-share-label"));
    const whatsapp = text("a", "Enviar por WhatsApp", "btn btn-primary");
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
    const share = text("button", "Compartir enlace", "btn btn-secondary");
    share.type = "button";
    share.addEventListener("click", async () => {
      try {
        if (navigator.share) await navigator.share({ title: "Reto diario de Clínicos", text: message });
        else {
          await navigator.clipboard.writeText(message);
          notice.textContent = "Enlace y resultado copiados. ¡Compártelos con tus amigos!";
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        notice.textContent = message;
      }
    });
    const shareActions = document.createElement("div");
    shareActions.className = "daily-actions";
    shareActions.append(whatsapp, share);
    shareBlock.append(shareActions);

    const appBlock = document.createElement("section");
    appBlock.className = "daily-share";
    appBlock.append(text("p", "LA APP", "daily-share-label"));
    const appLink = text("a", "Descargar Clínicos en Google Play", "btn btn-secondary");
    appLink.href = PLAY;
    appLink.target = "_blank";
    appLink.rel = "noopener noreferrer";
    appBlock.append(appLink);

    game.append(shareBlock, appBlock);
  }

  async function submit() {
    if (!attempt || submitting) return;
    submitting = true;
    game.replaceChildren(text("p", "Guardando tu resultado…"));
    notice.textContent = "";
    try {
      const result = await request<Result>({ action: "submit", token: attempt.token, answers: attempt.answers });
      resultView(result);
      void updatePeople();
    } catch (error) {
      game.replaceChildren(text("h2", "No pudimos guardar tu resultado todavía."));
      notice.textContent = error instanceof Error ? error.message : "Comprueba tu conexión.";
      const retry = text("button", "Reintentar guardar", "btn btn-primary");
      retry.type = "button";
      retry.onclick = () => void submit();
      retry.hidden = error instanceof RequestError && [401, 410].includes(error.status);
      const reset = text("button", "Volver al inicio", "btn btn-secondary");
      reset.type = "button";
      reset.onclick = () => {
        attempt = undefined;
        try { localStorage.removeItem(STORE); } catch {}
        void load();
      };
      game.append(retry, reset);
    } finally { submitting = false; }
  }

  function questionView() {
    if (!attempt) return;
    const index = attempt.answers.length;
    if (index === 3) { void submit(); return; }
    const question = challenge.questions[index];
    game.replaceChildren(text("p", `PREGUNTA ${index + 1} DE 3 · ${challenge.title}`, "daily-eyebrow"));
    const progress = document.createElement("progress");
    progress.max = 3;
    progress.value = index;
    progress.setAttribute("aria-label", "Preguntas respondidas");
    game.append(progress);
    const heading = text("h2", question.question);
    heading.tabIndex = -1;
    const group = document.createElement("fieldset");
    const legend = text("legend", "Toca una respuesta");
    group.append(legend);
    question.options.forEach((option, i) => {
      const label = document.createElement("label");
      label.className = "daily-option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "answer";
      radio.value = String(i);
      radio.addEventListener("change", () => {
        if (!attempt) return;
        attempt.answers.push(i);
        saveAttempt();
        void feedbackView(index, i);
      });
      label.append(radio, text("span", option));
      group.append(label);
    });
    game.append(heading, group);
    heading.focus();
  }

  async function feedbackView(questionIndex: number, choice: number) {
    if (!attempt) return;
    game.replaceChildren(text("p", "Revisando tu respuesta…"));
    notice.textContent = "";
    try {
      const feedback = await request<AnswerFeedback>({ action: "answer", token: attempt.token, index: questionIndex, answer: choice });
      const question = challenge.questions[questionIndex];
      game.replaceChildren(text("p", `PREGUNTA ${questionIndex + 1} DE 3 · ${challenge.title}`, "daily-eyebrow"));
      const verdict = text("h2", feedback.correct ? "¡Correcta!" : "No fue esta vez…", feedback.correct ? "daily-correct" : "daily-wrong");
      const detail = text("p", `Respuesta correcta: ${question.options[feedback.correctAnswer]}`, "daily-correct");
      game.append(verdict, detail, text("p", feedback.explanation, "daily-explain"));
      const next = text("button", questionIndex === 2 ? "Ver mi resultado" : "Siguiente pregunta", "btn btn-primary");
      next.type = "button";
      next.onclick = () => questionView();
      game.append(next);
    } catch (error) {
      notice.textContent = error instanceof Error ? error.message : "No se pudo cargar la explicación.";
      game.replaceChildren(text("h2", "Respuesta guardada."));
      const next = text("button", questionIndex === 2 ? "Ver mi resultado" : "Siguiente pregunta", "btn btn-primary");
      next.type = "button";
      next.onclick = () => questionView();
      game.append(next);
    }
  }

  function intro() {
    game.replaceChildren(text("p", `RETO DE HOY · ${challenge.date}`, "daily-eyebrow"), text("h2", challenge.title));
    const form = document.createElement("form");
    form.className = "daily-intro-form";
    const input = document.createElement("input");
    input.id = "daily-name";
    input.name = "name";
    input.maxLength = 30;
    input.placeholder = "Tu nombre o apodo (opcional)";
    input.setAttribute("autocomplete", "nickname");
    input.setAttribute("aria-label", "Tu nombre o apodo (opcional)");
    input.className = "daily-name daily-name-big";
    const consent = text("p", "Tu apodo y aciertos aparecen en la lista pública de abajo.", "daily-community-note");
    const start = text("button", "Comenzar reto", "btn btn-primary btn-block daily-start");
    start.type = "submit";
    form.append(input, start, consent);
    form.onsubmit = async event => {
      event.preventDefault();
      start.disabled = true;
      start.textContent = "Preparando tu reto…";
      notice.textContent = "";
      try {
        const session = await request<{ token: string }>({ action: "start", date: challenge.date, name: input.value.trim() });
        attempt = { date: challenge.date, token: session.token, answers: [] };
        saveAttempt();
        questionView();
      } catch (error) {
        notice.textContent = error instanceof Error ? error.message : "No se pudo iniciar el reto.";
        if (error instanceof RequestError && error.status === 409) {
          void load();
          return;
        }
        start.disabled = false;
        start.textContent = "Comenzar reto";
      }
    };
    game.append(form);
    window.setTimeout(() => input.focus(), 60);
  }

  async function load() {
    game.replaceChildren(text("p", "Preparando el reto de hoy…"));
    refresh.disabled = true;
    try {
      challenge = await request<Challenge>();
      showPeople(challenge.participants);
      const sharedDay = new URLSearchParams(window.location.hash.split("?")[1]).get("dia");
      if (sharedDay && sharedDay !== challenge.date) notice.textContent = "El reto que compartieron ya terminó. ¡Puedes jugar el de hoy!";
      attempt = loadAttempt(challenge.date);
      if (attempt) questionView(); else intro();
      refresh.disabled = false;
    } catch {
      game.replaceChildren(text("h2", "El reto no está disponible en este momento."), text("p", "Comprueba tu conexión. Si el problema continúa, vuelve más tarde."));
      const retry = text("button", "Volver a intentar", "btn btn-primary");
      retry.type = "button";
      retry.onclick = () => void load();
      game.append(retry);
      people.replaceChildren(text("li", "No se pudo cargar la lista de participantes.", "daily-empty"));
    }
  }
  void load();
  return root;
}

registerRoute({ path: "/reto-diario", title: "Reto diario de Clínicos", nav: false, render });
