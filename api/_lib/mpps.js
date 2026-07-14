const fs = require("fs");
const path = require("path");
const https = require("https");

/** Profesiones médicas aceptadas en SACS (texto puede venir con entidades HTML). */
const PROFESIONES_MEDICOS = [
  "CIRUJANO",
  "INTEGRAL COMUNITARIO",
  "MÉDICO",
  "MEDICO",
];

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

/** Formato que acepta SACS: V-12345678 */
function cedulaSacsFormat(input) {
  const d = digitsOnly(input);
  if (!d) return "";
  return `V-${d}`;
}

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&Eacute;/gi, "É")
    .replace(/&eacute;/gi, "é")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&iacute;/gi, "í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&oacute;/gi, "ó")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&aacute;/gi, "á")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&uacute;/gi, "ú")
    .replace(/&Ntilde;/gi, "Ñ")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isMedicoProfesion(profesion) {
  const p = decodeHtmlEntities(profesion).toUpperCase();
  return PROFESIONES_MEDICOS.some((x) => p.includes(x.toUpperCase()));
}

function loadLocalIndex() {
  if (cacheByMpps) return cacheByMpps;
  cacheByMpps = new Map();
  const file = path.join(__dirname, "..", "data", "medicos-sacs.json");
  if (!fs.existsSync(file)) return cacheByMpps;
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const row of list) {
    const key = normalizeMpps(row.mpps || row.consultado || row.licencia || row.matricula);
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

function matchMpps(rowMpps, inputMpps) {
  return digitsOnly(rowMpps) && digitsOnly(rowMpps) === digitsOnly(inputMpps);
}

function pickMatch(rows, cedula, mpps) {
  const list = rows || [];
  const medicos = list.filter((r) => isMedicoProfesion(r.profesion));
  const pool = medicos.length ? medicos : list;
  return (
    pool.find(
      (r) =>
        matchCedula(r.cedula, cedula) &&
        matchMpps(r.mpps || r.licencia || r.matricula || r.consultado, mpps),
    ) ||
    pool.find((r) => matchCedula(r.cedula, cedula)) ||
    null
  );
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
          Referer: `https://${SACS_HOST}${SACS_PATH}`,
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

/** Extrae arrays JSON embebidos en la respuesta xajax (tableProfesion / createTable). */
function extractJsonArrays(xmlText) {
  if (!xmlText) return [];
  const out = [];
  const re = /(?:xajax_tableProfesion|xajax_createTable)\('(\[.*?\])'\)/gs;
  let m;
  while ((m = re.exec(xmlText))) {
    try {
      const raw = m[1]
        .replace(/\\'/g, "'")
        .replace(/&quot;/g, '"');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) out.push(...arr);
    } catch {
      /* ignore */
    }
  }
  // Fallback: cualquier array JSON grande en CDATA
  if (!out.length) {
    const arrays = [...xmlText.matchAll(/(\[\s*\{[\s\S]*?\}\s*\])/g)];
    for (const a of arrays) {
      try {
        const arr = JSON.parse(a[1]);
        if (Array.isArray(arr) && arr.length && (arr[0].cedula || arr[0].licencia || arr[0].matricula)) {
          out.push(...arr);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

function normalizeSacsRow(row, fallbackMpps) {
  return {
    cedula: String(row.cedula || ""),
    nombre: String(row.nombre1 || row.nombre || ""),
    apellido: String(row.apellido1 || row.apellido || ""),
    profesion: decodeHtmlEntities(row.profesion || ""),
    mpps: normalizeMpps(row.licencia || row.matricula || row.mpps || fallbackMpps),
    consultado: normalizeMpps(fallbackMpps),
  };
}

async function consultarSacsPorCedula(cedulaInput) {
  const ced = cedulaSacsFormat(cedulaInput);
  if (!ced) return [];
  const body = `xajax=getPrfsnalByCed&xajaxargs[]=${encodeURIComponent(ced)}`;
  const xml = await postSacs(body);
  let nombre1 = "";
  let apellido1 = "";
  const userMatch = xml.match(/xajax_userTable\('(\{.*?\})'\)/s);
  if (userMatch) {
    try {
      const u = JSON.parse(userMatch[1]);
      nombre1 = String(u.nombre1 || "");
      apellido1 = String(u.apellido1 || "");
    } catch {
      /* ignore */
    }
  }
  return extractJsonArrays(xml).map((r) =>
    normalizeSacsRow(
      {
        ...r,
        nombre1: r.nombre1 || nombre1,
        apellido1: r.apellido1 || apellido1,
      },
      r.licencia || r.matricula,
    ),
  );
}

async function consultarSacsPorMpps(mpps) {
  const mat = normalizeMpps(mpps);
  if (!mat) return [];
  const body = `xajax=getPrfsnalMatricula&xajaxargs[]=${encodeURIComponent(mat)}`;
  const xml = await postSacs(body);
  return extractJsonArrays(xml).map((r) => normalizeSacsRow(r, mat));
}

/**
 * Valida cédula + MPPS: base local, luego SACS en vivo (por cédula y/o matrícula).
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
  let match = pickMatch(rows, cedula, mpps);

  if (!match) {
    const errors = [];
    try {
      const byCed = await consultarSacsPorCedula(cedula);
      if (byCed.length) {
        rows = byCed;
        source = "sacs-cedula";
        match = pickMatch(rows, cedula, mpps);
      }
    } catch (err) {
      errors.push(`cedula:${err.message}`);
    }

    if (!match) {
      try {
        const byMpps = await consultarSacsPorMpps(mpps);
        if (byMpps.length) {
          rows = byMpps;
          source = "sacs-mpps";
          match = pickMatch(rows, cedula, mpps);
        }
      } catch (err) {
        errors.push(`mpps:${err.message}`);
      }
    }

    if (!match && !rows.length && errors.length) {
      return {
        ok: false,
        error: `No se pudo consultar SACS: ${errors.join("; ")}`,
        code: "SACS_UNAVAILABLE",
      };
    }
  }

  if (!rows.length) {
    return {
      ok: false,
      error:
        "No se encontró ese código MPPS / cédula en SACS. Verifique los datos (cédula con V- y número MPPS).",
      code: "MPPS_NOT_FOUND",
    };
  }

  if (!match) {
    const huboCedula = rows.some((r) => matchCedula(r.cedula, cedula));
    const huboMpps = rows.some((r) =>
      matchMpps(r.mpps || r.licencia || r.matricula, mpps),
    );
    if (huboCedula && !huboMpps) {
      return {
        ok: false,
        error: "La cédula está en SACS, pero el código MPPS no coincide con ese registro.",
        code: "CEDULA_MISMATCH",
      };
    }
    if (huboMpps && !huboCedula) {
      return {
        ok: false,
        error: "Ese MPPS existe en SACS, pero pertenece a otra cédula.",
        code: "CEDULA_MISMATCH",
      };
    }
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
  consultarSacsPorCedula,
  consultarSacsPorMpps,
};
