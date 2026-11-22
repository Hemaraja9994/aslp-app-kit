/* Draws a standard audiogram as SVG text, so the same picture is used on screen and in print.
   ASHA (1990): one octave across equals 20 dB down; AC symbols joined, BC symbols not joined;
   no-response shown with a downward arrow at the audiometer limit. */
import { AC_F, freqLabel, type Ear, type Kind, type Thresholds } from "./audiology";

export function audiogramSvg(d: Thresholds, maxWidth = 560): string {
  const oct = 64, dbPx = oct / 20, L = 46, T = 42, W = L + oct * 5 + 24, H = T + 130 * dbPx + 16;
  const x = (f: number) => L + Math.log2(f / 250) * oct, y = (v: number) => T + (v + 10) * dbPx;
  const parts: string[] = [];
  const label = (["R", "L"] as Ear[]).map(e => `${e === "R" ? "Right" : "Left"} ear air conduction: ${AC_F.map(f => `${freqLabel(f)} ${d.AC[e][f] ?? "not tested"}`).join(", ")}`).join(". ");
  parts.push(`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-width:${maxWidth}px;display:block;margin:0 auto" role="img" aria-label="Audiogram. ${label}">`);
  for (let v = -10; v <= 120; v += 10)
    parts.push(`<line x1="${L}" x2="${x(8000)}" y1="${y(v)}" y2="${y(v)}" stroke="var(--color-line)" stroke-width="${v === 0 ? 1.4 : 0.8}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="13" fill="var(--color-muted)">${v}</text>`);
  for (const f of AC_F) {
    const inter = f === 3000 || f === 6000;
    parts.push(`<line x1="${x(f)}" x2="${x(f)}" y1="${T}" y2="${y(120)}" stroke="var(--color-line)" stroke-width="0.8"${inter ? ' stroke-dasharray="3 3"' : ""}/><text x="${x(f)}" y="${T - 8}" text-anchor="middle" font-size="13" fill="var(--color-muted)">${freqLabel(f)}</text>`);
  }
  parts.push(`<text x="${(L + x(8000)) / 2}" y="12" text-anchor="middle" font-size="13" fill="var(--color-muted)">Frequency (Hz)</text><text x="10" y="${(T + H) / 2}" transform="rotate(-90 10 ${(T + H) / 2})" text-anchor="middle" font-size="13" fill="var(--color-muted)">Hearing level (dB HL)</text>`);

  const arrow = (cx: number, cy: number, dir: number, col: string) => `<path d="M${cx} ${cy + 8}l${dir * 8} 10m0 0l${-dir * 5} -1m${dir * 5} 1l-1 -5" stroke="${col}" stroke-width="1.6" fill="none"/>`;
  const sym = (kind: Kind, e: Ear, f: number, v: number | "NR") => {
    const cx = x(f), nr = v === "NR", cy = y(nr ? 120 : v), R = e === "R", col = R ? "var(--color-right)" : "var(--color-left)";
    const masked = d.mask[(e + (kind === "AC" ? "A" : "B")) as keyof Thresholds["mask"]];
    let g = "";
    if (kind === "AC") {
      if (R && !masked) g = `<circle cx="${cx}" cy="${cy}" r="6" fill="var(--color-surface)" stroke="${col}" stroke-width="2"/>`;
      if (R && masked) g = `<path d="M${cx} ${cy - 7}L${cx + 7} ${cy + 5}H${cx - 7}Z" fill="var(--color-surface)" stroke="${col}" stroke-width="2"/>`;
      if (!R && !masked) g = `<path d="M${cx - 5} ${cy - 5}L${cx + 5} ${cy + 5}M${cx + 5} ${cy - 5}L${cx - 5} ${cy + 5}" stroke="${col}" stroke-width="2.2" stroke-linecap="round"/>`;
      if (!R && masked) g = `<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" fill="var(--color-surface)" stroke="${col}" stroke-width="2"/>`;
    } else {
      const ox = R ? -11 : 11;
      if (!masked) g = R ? `<path d="M${cx + ox + 4} ${cy - 6}L${cx + ox - 3} ${cy}L${cx + ox + 4} ${cy + 6}" stroke="${col}" stroke-width="2" fill="none"/>`
        : `<path d="M${cx + ox - 4} ${cy - 6}L${cx + ox + 3} ${cy}L${cx + ox - 4} ${cy + 6}" stroke="${col}" stroke-width="2" fill="none"/>`;
      else g = R ? `<path d="M${cx + ox + 4} ${cy - 7}H${cx + ox - 2}V${cy + 7}H${cx + ox + 4}" stroke="${col}" stroke-width="2" fill="none"/>`
        : `<path d="M${cx + ox - 4} ${cy - 7}H${cx + ox + 2}V${cy + 7}H${cx + ox - 4}" stroke="${col}" stroke-width="2" fill="none"/>`;
    }
    return g + (nr ? arrow(kind === "BC" ? cx + (R ? -11 : 11) : cx, cy, R ? -1 : 1, col) : "");
  };
  for (const e of ["R", "L"] as Ear[]) {
    let path = "", pen = false;
    for (const f of AC_F) { const v = d.AC[e][f]; if (typeof v !== "number") { pen = false; continue; } path += `${pen ? "L" : "M"}${x(f)} ${y(v)} `; pen = true; }
    if (path) parts.push(`<path d="${path}" fill="none" stroke="${e === "R" ? "var(--color-right)" : "var(--color-left)"}" stroke-width="1.4"${e === "L" ? ' stroke-dasharray="6 4"' : ""}/>`);
  }
  for (const k of ["AC", "BC"] as Kind[]) for (const e of ["R", "L"] as Ear[]) for (const [f, v] of Object.entries(d[k][e])) parts.push(sym(k, e, Number(f), v));
  parts.push("</svg>");
  return parts.join("");
}
