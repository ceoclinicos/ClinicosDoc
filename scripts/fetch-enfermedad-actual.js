/**
 * Lee las "Enfermedad actual" de los documentos del médico en Firestore.
 * Uso: node scripts/fetch-enfermedad-actual.js <cedula> <pin>
 * Login via https://clinicos-doc.vercel.app/api/auth-login (custom token),
 * luego signInWithCustomToken -> idToken -> Firestore REST.
 */
const API_BASE = "https://clinicos-doc.vercel.app";
const API_KEY = "AIzaSyCqYo-LQ2l-ETTRiNYx5U4tbnFVIEscbYw";
const PROJECT = "clinicos-aed47";

const cedula = process.argv[2];
const pins = process.argv.slice(3);
if (!cedula || !pins.length) {
  console.error("Uso: node scripts/fetch-enfermedad-actual.js <cedula> <pin...>");
  process.exit(1);
}

async function login(pin) {
  const res = await fetch(`${API_BASE}/api/auth-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: "auto", cedula, pin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login ${res.status}: ${data.error || res.statusText}`);
  return data;
}

async function exchange(customToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`signIn ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.idToken;
}

function decodeValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.mapValue) {
    const o = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) o[k] = decodeValue(val);
    return o;
  }
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeValue);
  return v.integerValue ?? v.doubleValue ?? v.booleanValue ?? null;
}

async function listDocs(idToken, uid) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const out = [];
  let pageToken = "";
  do {
    const url = `${base}/clinicosdoc_user/${uid}/documents?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`firestore ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    out.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return out;
}

function extractSection(content, names) {
  // Secciones marcadas con [[SECTION:Nombre]] o encabezados tipo "ENFERMEDAD ACTUAL"
  const re = /\[\[SECTION:([^\]]+)\]\]/g;
  const marks = [];
  let m;
  while ((m = re.exec(content))) marks.push({ name: m[1].trim(), start: m.index, end: re.lastIndex });
  const found = [];
  for (let i = 0; i < marks.length; i++) {
    const cur = marks[i];
    if (names.some((n) => cur.name.toLowerCase().includes(n))) {
      const end = i + 1 < marks.length ? marks[i + 1].start : content.length;
      const body = content.slice(cur.end, end).trim();
      if (body) found.push(body);
    }
  }
  return found;
}

async function main() {
  let loginData = null;
  for (const pin of pins) {
    try {
      loginData = await login(pin);
      console.log(`Login OK con PIN terminado en ...${pin.slice(-2)} (uid=${loginData.uid})`);
      break;
    } catch (e) {
      console.log(`PIN ${pin.slice(0, 2)}... falló: ${e.message}`);
    }
  }
  if (!loginData) {
    console.error("Ningún PIN funcionó.");
    process.exit(2);
  }

  const idToken = await exchange(loginData.token);
  const docs = await listDocs(idToken, loginData.uid);
  console.log(`Documentos encontrados: ${docs.length}`);

  const names = ["enfermedad actual", "enfermedadactual"];
  const results = [];
  for (const d of docs) {
    const fields = {};
    for (const [k, v] of Object.entries(d.fields || {})) fields[k] = decodeValue(v);
    const content = String(fields.content || "");
    const bodies = extractSection(content, names);
    for (const body of bodies) {
      results.push({
        docId: d.name.split("/").pop(),
        type: fields.type || fields.typeLabel || "",
        patientNombre: fields.patientNombre || "",
        createdAt: fields.createdAt || "",
        enfermedadActual: body,
      });
    }
  }
  console.log(`Secciones 'Enfermedad actual' extraídas: ${results.length}`);
  require("fs").writeFileSync(
    "enfermedades_actuales_23536843.json",
    JSON.stringify(results, null, 2),
    "utf8",
  );
  console.log("Guardado en enfermedades_actuales_23536843.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
