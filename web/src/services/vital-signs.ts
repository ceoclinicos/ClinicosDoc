/** Signos vitales — paridad con VitalSignsParser de la app Android. */

export type VitalSigns = {
  tas: string;
  tad: string;
  fr: string;
  fc: string;
  sato2: string;
};

export function emptyVitals(): VitalSigns {
  return { tas: "", tad: "", fr: "", fc: "", sato2: "" };
}

function isPresent(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v === "0" || v === "0.0" || v === "0/0" || v.toLowerCase() === "---") return false;
  return true;
}

function taCombined(v: VitalSigns): string {
  if (isPresent(v.tas) && isPresent(v.tad)) return `${v.tas.trim()}/${v.tad.trim()}`;
  if (isPresent(v.tas)) return v.tas.trim();
  if (isPresent(v.tad)) return v.tad.trim();
  return "";
}

export function vitalsToLine(v: VitalSigns): string {
  const parts: string[] = [];
  const ta = taCombined(v);
  if (isPresent(ta)) parts.push(`TA: ${ta} mmHg`);
  if (isPresent(v.fr)) parts.push(`FR: ${v.fr.trim()} rpm`);
  if (isPresent(v.fc)) parts.push(`FC: ${v.fc.trim()} lpm`);
  if (isPresent(v.sato2)) parts.push(`SaTO2: ${v.sato2.trim()}%`);
  return parts.join(" | ");
}

const vitalLineHint = /(TA:|FR:|FC:|SaTO2:)/i;
const taRegex = /TA:\s*([^\s|]+)\s*mmHg/i;
const frRegex = /FR:\s*([^\s|]+)\s*rpm/i;
const fcRegex = /FC:\s*([^\s|]+)\s*lpm/i;
const sato2Regex = /SaTO2:\s*([^\s|]+)\s*%/i;

export function isPhysicalExamTitle(title: string): boolean {
  return /^examen\s+f[ií]sico$/i.test(title.trim()) || /examen\s+f[ií]sico/i.test(title);
}

function fromTaCombined(ta: string): { tas: string; tad: string } {
  const parts = ta.trim().split("/", 2);
  if (parts.length >= 2) return { tas: parts[0].trim(), tad: parts[1].trim() };
  if (ta.trim()) return { tas: ta.trim(), tad: "" };
  return { tas: "", tad: "" };
}

export function parseVitalsFromBody(body: string): VitalSigns {
  const firstLine = body.split(/\n/).find((l) => l.trim())?.trim() ?? "";
  if (!vitalLineHint.test(firstLine)) return emptyVitals();
  const ta = fromTaCombined(taRegex.exec(firstLine)?.[1] ?? "");
  return {
    tas: ta.tas,
    tad: ta.tad,
    fr: frRegex.exec(firstLine)?.[1] ?? "",
    fc: fcRegex.exec(firstLine)?.[1] ?? "",
    sato2: sato2Regex.exec(firstLine)?.[1] ?? "",
  };
}

export function bodyWithoutVitals(body: string): string {
  const lines = body.split("\n");
  const idx = lines.findIndex((l) => l.trim());
  if (idx >= 0 && vitalLineHint.test(lines[idx].trim())) lines.splice(idx, 1);
  return lines.join("\n").replace(/^\n+/, "");
}

export function applyVitalsToBody(body: string, vitals: VitalSigns): string {
  const lines = body.split("\n");
  const firstNonBlank = lines.findIndex((l) => l.trim());
  const newLine = vitalsToLine(vitals);

  if (!newLine) {
    if (firstNonBlank >= 0 && vitalLineHint.test(lines[firstNonBlank].trim())) {
      lines.splice(firstNonBlank, 1);
    }
    return lines.join("\n").replace(/^\n+/, "");
  }

  if (firstNonBlank < 0) return newLine;
  if (vitalLineHint.test(lines[firstNonBlank].trim())) {
    lines[firstNonBlank] = newLine;
    return lines.join("\n");
  }
  lines.splice(Math.max(firstNonBlank, 0), 0, newLine);
  return lines.join("\n");
}

/** HTML de inputs ordenados: TAS/TAD → FR → FC → SaTO2 */
export function vitalSignsFieldsHtml(vitals: VitalSigns, prefix = "vs"): string {
  return `
    <div class="vitals-editor card-panel">
      <p class="vitals-title"><strong>Signos vitales</strong></p>
      <div class="vitals-ta-row">
        <label>TAS (mmHg)<input type="text" inputmode="decimal" name="${prefix}-tas" value="${escapeAttr(vitals.tas)}" maxlength="8" /></label>
        <span class="vitals-slash">/</span>
        <label>TAD (mmHg)<input type="text" inputmode="decimal" name="${prefix}-tad" value="${escapeAttr(vitals.tad)}" maxlength="8" /></label>
      </div>
      <label>FR (rpm)<input type="text" inputmode="decimal" name="${prefix}-fr" value="${escapeAttr(vitals.fr)}" maxlength="8" /></label>
      <label>FC (lpm)<input type="text" inputmode="decimal" name="${prefix}-fc" value="${escapeAttr(vitals.fc)}" maxlength="8" /></label>
      <label>SaTO2 (%)<input type="text" inputmode="decimal" name="${prefix}-sato2" value="${escapeAttr(vitals.sato2)}" maxlength="8" /></label>
    </div>
  `;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function readVitalsFromForm(root: ParentNode, prefix = "vs"): VitalSigns {
  const dig = (name: string) =>
    String((root.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value ?? "")
      .replace(/[^\d./]/g, "")
      .slice(0, 8);
  return {
    tas: dig(`${prefix}-tas`),
    tad: dig(`${prefix}-tad`),
    fr: dig(`${prefix}-fr`),
    fc: dig(`${prefix}-fc`),
    sato2: dig(`${prefix}-sato2`),
  };
}
