/* Clinical calculations, kept separate from the screen so they can be tested.
   Sources: WHO World Report on Hearing (2021); Olusanya, Davis & Hoffman, Bull WHO 2019;97(10):725–728,
   Table 2 (grades and hearing-experience descriptors); ASHA (1990) Guidelines for audiometric symbols. */

export const AC_F = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000] as const;
export const BC_F = [250, 500, 1000, 2000, 3000, 4000] as const;
export const PTA4 = [500, 1000, 2000, 4000];
export const PTA3 = [500, 1000, 2000];

export type Ear = "R" | "L";
export type Kind = "AC" | "BC";
export type Threshold = number | "NR";
export type EarMap = Record<string, Threshold>;
export interface Thresholds { AC: Record<Ear, EarMap>; BC: Record<Ear, EarMap>; mask: { RA: boolean; LA: boolean; RB: boolean; LB: boolean } }

export const emptyThresholds = (): Thresholds => ({ AC: { R: {}, L: {} }, BC: { R: {}, L: {} }, mask: { RA: false, LA: false, RB: false, LB: false } });

export interface WhoGrade { id: string; g: string; lo: number; hi: number; quiet: string; noise: string }
export const WHO: WhoGrade[] = [
  { id: "normal", g: "Normal hearing", lo: -Infinity, hi: 20, quiet: "Excellent or good hearing", noise: "Good hearing, or rarely has difficulty following a conversation" },
  { id: "mild", g: "Mild hearing loss", lo: 20, hi: 35, quiet: "Does not have problems hearing what is said", noise: "May have real difficulty following or taking part in a conversation" },
  { id: "moderate", g: "Moderate hearing loss", lo: 35, hi: 50, quiet: "May have difficulty hearing a normal voice", noise: "Has difficulty hearing and taking part in conversation" },
  { id: "modsevere", g: "Moderately severe hearing loss", lo: 50, hi: 65, quiet: "Can hear loud speech", noise: "Has great difficulty hearing and taking part in conversation" },
  { id: "severe", g: "Severe hearing loss", lo: 65, hi: 80, quiet: "Can hear loud speech directly in one's ear", noise: "Has very great difficulty hearing and taking part in conversation" },
  { id: "profound", g: "Profound hearing loss", lo: 80, hi: 95, quiet: "Has great difficulty hearing", noise: "Cannot hear any speech" },
  { id: "complete", g: "Complete or total hearing loss", lo: 95, hi: Infinity, quiet: "Profoundly deaf, hears no speech or loud sounds", noise: "Cannot hear any speech or sound" }
];
export const UNILATERAL: WhoGrade = { id: "unilateral", g: "Unilateral hearing loss", lo: NaN, hi: NaN,
  quiet: "Does not have problems unless sound is near the poorer hearing ear", noise: "May have real difficulty following or taking part in a conversation" };

export const whoGrade = (v: number): WhoGrade => WHO.find(w => v >= w.lo && v < w.hi)!;

/** Parse what the clinician typed. Returns undefined for blank, "NR", a number, or an error. */
export function parseThreshold(raw: string, kind: Kind): { value?: Threshold; error?: boolean } {
  const s = raw.trim().toUpperCase();
  if (!s) return {};
  if (s === "NR") return { value: "NR" };
  const n = Number(s), max = kind === "BC" ? 80 : 120;
  if (!Number.isFinite(n) || n < -10 || n > max || n % 5 !== 0) return { error: true };
  return { value: n };
}

export interface Avg { val: number | null; why?: "incomplete" | "nr" }
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Mean over the listed frequencies. Cannot be calculated if any is missing or a no-response. */
export function average(map: EarMap, freqs: number[]): Avg {
  const v = freqs.map(f => map[f]);
  if (v.some(x => x === undefined)) return { val: null, why: "incomplete" };
  if (v.some(x => x === "NR")) return { val: null, why: "nr" };
  return { val: round1((v as number[]).reduce((a, b) => a + b, 0) / v.length) };
}

export type HLType = "none" | "needBC" | "conductive" | "mixed" | "sensorineural" | "unknown";
export interface EarSummary { p4: Avg; p3: Avg; b4: Avg; abg: number | null; gapsN: number; type: HLType }

/** Per ear: averages, mean air–bone gap at 0.5–4 kHz, and suggested type.
    Type rule: gap > 10 dB = conductive component; with BC average ≥ 20 dB HL it is mixed. */
export function earSummary(d: Thresholds, e: Ear): EarSummary {
  const p4 = average(d.AC[e], PTA4), p3 = average(d.AC[e], PTA3), b4 = average(d.BC[e], PTA4);
  const gaps = PTA4.filter(f => typeof d.AC[e][f] === "number" && typeof d.BC[e][f] === "number")
    .map(f => (d.AC[e][f] as number) - (d.BC[e][f] as number));
  const abg = gaps.length ? round1(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  let type: HLType = "unknown";
  if (p4.val != null) {
    if (p4.val < 20) type = "none";
    else if (abg == null || gaps.length < 3) type = "needBC";
    else if (abg > 10) type = b4.val != null && b4.val >= 20 ? "mixed" : "conductive";
    else type = "sensorineural";
  }
  return { p4, p3, b4, abg, gapsN: gaps.length, type };
}

export interface Overall { grade: WhoGrade | null; better: number | null; worse: number | null; unilateral: boolean; reason?: "incomplete" | "nr" }

/** WHO 2021: grade on the better-ear 4-frequency average. Unilateral = better ear < 20 and worse ear ≥ 35. */
export function overallGrade(R: EarSummary, L: EarSummary): Overall {
  if (R.p4.val == null || L.p4.val == null) {
    const reason = R.p4.why === "nr" || L.p4.why === "nr" ? "nr" : "incomplete";
    return { grade: null, better: null, worse: null, unilateral: false, reason };
  }
  const better = Math.min(R.p4.val, L.p4.val), worse = Math.max(R.p4.val, L.p4.val);
  const unilateral = better < 20 && worse >= 35;
  return { grade: unilateral ? UNILATERAL : whoGrade(better), better, worse, unilateral };
}

export const TYPE_LABEL: Record<HLType, string> = {
  none: "No hearing loss on the pure-tone average",
  needBC: "Type needs bone conduction at 3 or more of 0.5, 1, 2, 4 kHz",
  conductive: "Conductive (suggested)",
  mixed: "Mixed (suggested)",
  sensorineural: "Sensorineural (suggested)",
  unknown: "–"
};

export const fmtAvg = (a: Avg): string => a.val != null ? `${a.val} dB HL` : a.why === "nr" ? "Not calculable (no response)" : "–";
export const freqLabel = (f: number): string => f >= 1000 ? `${f / 1000}k` : String(f);
