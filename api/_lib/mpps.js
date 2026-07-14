const fs = require("fs");
const path = require("path");
const https = require("https");

const PROFESIONES_MEDICOS = ["CIRUJANO", "INTEGRAL COMUNITARIO"];
const SACS_HOST = "sistemas.sacs.gob.ve";
const SACS_PATH = "/consultas/prfsnal_salud";

let cacheByMpps = null;

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function normalizeMpps(input) {
  const d = digitsOnly(input);
  if (!d) return "";
  return `MPPS-${d}`;
}

function isMedicoProfesion(profesion) {
  const p = String(profesion || "").toUpperCase();
  return PROFESIONES_MEDICOS.some((x) => p.includes(x));
}

function loadLocalIndex() {
  if (cacheByMpps) return cacheByMpps;
  cacheByMpps = new Map();
  const file = path.join(__dirname, "..", "data", "medicos-sacs.json");
  if (!fs.existsSync(file)) return cacheByMpps;
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const row of list) {
    const key = normalizeMpps(row.mpps || row.consultado);
    if (!key) continue;
    if (!cacheByMpps.has(key)) cacheByMpps.set(key, []);
    cacheByMpps.get(key).push(row);
  }
  return cacheByMpps;
}

function matchCedula(rowCedula, inputCedula) {
  const a = digitsOnly(rowCedula);
  const b = digitsOnly(inputCedula);
  return a && b && a === b;
}

function pickMatch(rows, cedula) {
  const medicos = (rows || []).filter((r) => isMedicoProfesion(r.profesion));
  const pool = medicos.length ? medicos : rows || [];
  return pool.find((r) => matchCedula(r.cedula, cedula)) || null;
}

function parseSacsXml(xmlText, matricula) {
  if (!xmlText) return [];
  let texto = xmlText;
  if (texto.includes("&lt;")) {
    texto = texto
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  }
  const cdata = [...texto.matchAll(/<!\[CDATA\[(.*?)\]\]>/gs)].map((m) => m[1]);
  if (cdata.length) texto = cdata.join(" ");

  const out = [];
  const trs = [...texto.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)];
  for (const m of trs) {
    const tds = [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/gis)].map((td) =>
      td[1].replace(/<[^>]+>/g, "").trim(),
    );
    if (tds.length >= 5) {
      out.push({
        consultado: matricula,
        cedula: tds[0],
        nombre: tds[1],
        apellido: tds[2],
        profesion: tds[3],
        mpps: tds[4],
      });
    }
  }
  return out;
}

function postSacs(body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: SACS_HOST,
        path: SACS_PATH,
        method: "POST",
        rejectUnauthorized: false,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
        },
        timeout: 25000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout consultando SACS"));
    });
    req.write(body);
    req.end();
  });
}

async function consultarSacsLive(mpps) {
  const payloadFile = path.join(__dirname, "..", "data", "sacs_payload.txt");
  let template = "xajax=nroRegistro&xajaxargs[]=2&xajaxargs[]=MPPS&xajaxargs[]=MPPS-162446";
  if (fs.existsSync(payloadFile)) {
    template = fs.readFileSync(payloadFile, "utf8").trim() || template;
  }
  const body = template.replace(/MPPS-\d+/g, mpps);
  const xml = await postSacs(body);
  return parseSacsXml(xml, mpps);
}

/**
 * Valida cédula + MPPS contra base local y, si falta, contra SACS en vivo.
 * @returns {{ ok: true, source, medico } | { ok: false, error, code }}
 */
async function validarMppsCedula(cedulaInput, mppsInput) {
  const cedula = String(cedulaInput || "").trim();
  const mpps = normalizeMpps(mppsInput);
  if (!digitsOnly(cedula) || digitsOnly(cedula).length < 6) {
    return { ok: false, error: "Cédula inválida", code: "CEDULA_INVALID" };
  }
  if (!mpps) {
    return { ok: false, error: "Código MPPS requerido", code: "MPPS_REQUIRED" };
  }

  const index = loadLocalIndex();
  let rows = index.get(mpps) || [];
  let source = "local";

  let match = pickMatch(rows, cedula);
  if (!match) {
    try {
      const live = await consultarSacsLive(mpps);
      if (live.length) {
        rows = live;
        source = "sacs";
        match = pickMatch(rows, cedula);
      }
    } catch (err) {
      if (!rows.length) {
        return {
          ok: false,
          error: `No se pudo consultar SACS: ${err.message}`,
          code: "SACS_UNAVAILABLE",
        };
      }
    }
  }

  if (!rows.length) {
    return {
      ok: false,
      error: "No se encontró ese código MPPS en el registro SACS",
      code: "MPPS_NOT_FOUND",
    };
  }

  if (!match) {
    return {
      ok: false,
      error: "La cédula no coincide con ese código MPPS en SACS",
      code: "CEDULA_MISMATCH",
    };
  }

  if (!isMedicoProfesion(match.profesion)) {
    return {
      ok: false,
      error: `El registro SACS no es de médico (${match.profesion || "sin profesión"})`,
      code: "NOT_MEDICO",
    };
  }

  return {
    ok: true,
    source,
    medico: {
      cedula: match.cedula,
      nombre: match.nombre,
      apellido: match.apellido,
      nombreCompleto: `${match.nombre || ""} ${match.apellido || ""}`.trim(),
      profesion: match.profesion,
      mpps: normalizeMpps(match.mpps || mpps),
    },
  };
}

module.exports = {
  validarMppsCedula,
  normalizeMpps,
  digitsOnly,
};
