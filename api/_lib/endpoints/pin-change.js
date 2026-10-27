const { getAdmin } = require("../firebase");
const { assertPin6, assertPinLogin, hashPin, hashPassword, normalizeCedula } = require("../pin");
const { applyCors } = require("../cors");
const { parseBody } = require("../body");
const { apiError } = require("../errors");
const { requireMedicoAuth } = require("../require-medico");

/**
 * Cambia el PIN estando autenticado (legado 4 dígitos → 6).
 * Body: { oldPin, newPin }
 */
module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { admin, uid, decoded } = await requireMedicoAuth(req, getAdmin());
    const db = admin.firestore();
    const body = parseBody(req);
    const oldPin = String(body.oldPin || "");
    const newPin = String(body.newPin || "");
    assertPinLogin(oldPin);
    assertPin6(newPin);
    if (oldPin === newPin) {
      return res.status(400).json({ error: "El PIN nuevo debe ser distinto al actual" });
    }

    const userRef = db.collection("clinicosdoc_user").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const data = userSnap.data() || {};
    const cedula = normalizeCedula(decoded.cedula || data.cedulaNormalizada || data.cedula || "");
    const okPassword = data.passwordHash && data.passwordHash === hashPassword(oldPin);
    const okPinHash =
      data.pinHash && cedula && data.pinHash === hashPin(cedula, oldPin);

    // También aceptar PIN de profesionales vinculados
    let okProf = false;
    if (!okPassword && !okPinHash && cedula) {
      const keys = [cedula, cedula.replace(/\D/g, "")].filter(Boolean);
      for (const key of keys) {
        const snap = await db.collection("profesionales").doc(key).get();
        if (!snap.exists) continue;
        const p = snap.data() || {};
        if (p.pinHash === hashPin(p.cedula || key, oldPin)) {
          okProf = true;
          await snap.ref.set(
            { pinHash: hashPin(p.cedula || key, newPin), updatedAt: new Date().toISOString() },
            { merge: true },
          );
          break;
        }
      }
    }

    if (!okPassword && !okPinHash && !okProf) {
      return res.status(401).json({ error: "PIN actual incorrecto" });
    }

    const now = new Date().toISOString();
    const patch = {
      passwordHash: hashPassword(newPin),
      updatedAt: now,
      pinUpgradedAt: now,
    };
    if (cedula) {
      patch.pinHash = hashPin(cedula, newPin);
      patch.cedulaNormalizada = cedula;
    }
    await userRef.set(patch, { merge: true });

    return res.status(200).json({ ok: true, pinDigits: 6 });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudo actualizar el PIN" });
    }
    console.error("pin-change", err);
    return apiError(
      res,
      500,
      "No se pudo actualizar el PIN",
      err?.message || String(err),
      "PIN_CHANGE_FAILED",
    );
  }
};
