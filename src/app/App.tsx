/* Audiogram & WHO Grade: enter thresholds ear by ear, see the audiogram, read the averages,
   type and WHO grade with the supporting references, and keep records on this device. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, BookOpen, ClipboardList, Ear as EarIcon, LineChart as ChartIcon } from "lucide-react";
import { AppShell, type Section } from "@/shell/AppShell";
import { Button, Callout, Check, Input, Panel, ResponsiveTable, Segmented, Stepper, cx } from "@/shell/ui";
import { References } from "@/shell/References";
import { usePersistent } from "@/shell/storage";
import { toast } from "@/shell/toast";
import { downloadCSV, esc, fmtDate, printHTML, todayISO, uid } from "@/shell/lib";
import { AC_F, BC_F, TYPE_LABEL, WHO, earSummary, emptyThresholds, fmtAvg, freqLabel, overallGrade, parseThreshold, type Ear, type EarSummary, type Kind, type Thresholds } from "./audiology";
import { audiogramSvg } from "./audiogramSvg";
import refs from "./refs.json";

type Raw = Record<string, string>;                         // "AC-R-1000" -> what was typed
interface Draft { code: string; raw: Raw; mask: Thresholds["mask"] }
interface Rec { id: string; date: string; code: string; d: Thresholds; pR: number | null; pL: number | null; grade: string | null }

const blankDraft = (): Draft => ({ code: "", raw: {}, mask: emptyThresholds().mask });
const EAR_NAME: Record<Ear, string> = { R: "Right", L: "Left" };

function toThresholds(dr: Draft): { d: Thresholds; bad: Set<string> } {
  const d = emptyThresholds(), bad = new Set<string>();
  d.mask = { ...dr.mask };
  for (const [key, s] of Object.entries(dr.raw)) {
    const [k, e, f] = key.split("-") as [Kind, Ear, string];
    const p = parseThreshold(s, k);
    if (p.error) bad.add(key); else if (p.value !== undefined) d[k][e][f] = p.value;
  }
  return { d, bad };
}

function fromThresholds(d: Thresholds): Raw {
  const raw: Raw = {};
  for (const k of ["AC", "BC"] as Kind[]) for (const e of ["R", "L"] as Ear[]) for (const [f, v] of Object.entries(d[k][e])) raw[`${k}-${e}-${f}`] = String(v);
  return raw;
}

function EntryCard({ ear, cond, draft, bad, onRaw, onMask }: { ear: Ear; cond: Kind; draft: Draft; bad: Set<string>; onRaw: (k: string, v: string) => void; onMask: (k: keyof Draft["mask"], v: boolean) => void }) {
  const tone = ear === "R" ? "border-right" : "border-left";
  return (
    <div className={cx("rounded-xl border-l-4 bg-paper py-2 pl-2 pr-0 sm:p-4", tone)}>
      <div className="grid grid-cols-[3.4rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2 sm:grid-cols-[3.4rem_minmax(0,1fr)_minmax(0,1fr)]">
        <span className="text-xs font-bold text-muted">Hz</span>
        <span className={cx("text-center text-xs font-bold text-muted", cond !== "AC" && "hidden sm:block")}>Air (AC)</span>
        <span className={cx("text-center text-xs font-bold text-muted", cond !== "BC" && "hidden sm:block")}>Bone (BC)</span>
        {AC_F.map(f => {
          const ak = `AC-${ear}-${f}`, bk = `BC-${ear}-${f}`, hasBC = (BC_F as readonly number[]).includes(f);
          return (
            <div key={f} className="contents">
              <span className="text-[0.95rem] font-bold tabular-nums">{freqLabel(f)}</span>
              <div className={cx(cond !== "AC" && "hidden sm:block")}><Stepper label={`${EAR_NAME[ear]} air conduction ${f} Hz`} value={draft.raw[ak] ?? ""} onChange={v => onRaw(ak, v)} min={-10} max={120} allowNR invalid={bad.has(ak)} /></div>
              <div className={cx(cond !== "BC" && "hidden sm:block")}>{hasBC ? <Stepper label={`${EAR_NAME[ear]} bone conduction ${f} Hz`} value={draft.raw[bk] ?? ""} onChange={v => onRaw(bk, v)} min={-10} max={80} allowNR invalid={bad.has(bk)} />
                : <p className="m-0 text-center text-xs text-muted">Bone conduction not tested at {freqLabel(f)}</p>}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6">
        <Check checked={draft.mask[`${ear}A` as const]} onChange={v => onMask(`${ear}A` as const, v)}>AC masked</Check>
        <Check checked={draft.mask[`${ear}B` as const]} onChange={v => onMask(`${ear}B` as const, v)}>BC masked</Check>
      </div>
    </div>
  );
}

function SymbolKey() {
  const item = (ch: string, ear: Ear, text: string) => <li className="flex items-center gap-2"><b className={cx("inline-block w-5 text-center", ear === "R" ? "text-right" : "text-left")}>{ch}</b>{text}</li>;
  return (
    <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 text-[0.86rem]" aria-label="Symbol key">
      {item("O", "R", "Right AC")}{item("X", "L", "Left AC")}{item("△", "R", "Right AC masked")}{item("□", "L", "Left AC masked")}
      {item("<", "R", "Right BC")}{item(">", "L", "Left BC")}{item("[", "R", "Right BC masked")}{item("]", "L", "Left BC masked")}
      <li className="col-span-2 text-muted">A downward arrow means no response at the audiometer limit.</li>
    </ul>
  );
}

function EarResult({ ear, s }: { ear: Ear; s: EarSummary }) {
  const rows: [string, string][] = [
    ["PTA 0.5–4 kHz", fmtAvg(s.p4)], ["PTA 0.5–2 kHz", fmtAvg(s.p3)], ["BC average 0.5–4 kHz", fmtAvg(s.b4)],
    ["Mean air–bone gap", s.abg != null ? `${s.abg} dB (${s.gapsN} freq.)` : "–"],
    ["Degree (WHO cut-offs)", s.p4.val != null ? WHO.find(w => s.p4.val! >= w.lo && s.p4.val! < w.hi)!.g : "–"],
    ["Type", TYPE_LABEL[s.type]]
  ];
  return (
    <div className={cx("rounded-lg border-l-4 bg-paper py-2 pl-3 pr-2", ear === "R" ? "border-right" : "border-left")}>
      <h3 className="m-0 mb-1 text-base font-bold">{EAR_NAME[ear]} ear</h3>
      <dl className="m-0 grid grid-cols-[minmax(0,46%)_1fr] gap-x-3 gap-y-1 text-[0.92rem]">
        {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="m-0 tabular-nums">{v}</dd></div>)}
      </dl>
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [view, setView] = useState("enter");
  const [ear, setEar] = useState<Ear>("R");
  const [cond, setCond] = useState<Kind>("AC");
  const [draft, setDraft] = usePersistent<Draft>("aslp-kit-draft", blankDraft());
  const [recs, setRecs] = usePersistent<Rec[]>("aslp-kit-audiograms", []);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const { d, bad } = useMemo(() => toThresholds(draft), [draft]);
  const R = useMemo(() => earSummary(d, "R"), [d]), L = useMemo(() => earSummary(d, "L"), [d]);
  const overall = useMemo(() => overallGrade(R, L), [R, L]);
  const svg = useMemo(() => audiogramSvg(d), [d]);

  const sections: Section[] = [
    { id: "enter", label: "Enter", icon: EarIcon }, { id: "chart", label: "Audiogram", icon: ChartIcon },
    { id: "results", label: "Results", icon: Activity }, { id: "records", label: "Records", icon: ClipboardList }
  ];
  const go = (id: string) => { setView(id); window.scrollTo({ top: 0 }); };

  const onRaw = (k: string, v: string) => setDraft(p => ({ ...p, raw: { ...p.raw, [k]: v } }));
  const onMask = (k: keyof Draft["mask"], v: boolean) => setDraft(p => ({ ...p, mask: { ...p.mask, [k]: v } }));
  const hasAny = Object.keys(d.AC.R).length + Object.keys(d.AC.L).length > 0;

  const save = () => {
    if (!hasAny) { toast("Enter some thresholds first."); return; }
    if (bad.size) { toast("Fix the highlighted thresholds first."); return; }
    setRecs(r => [...r, { id: uid(), date: todayISO(), code: draft.code.trim(), d, pR: R.p4.val, pL: L.p4.val, grade: overall.grade?.g ?? null }]);
    toast("Record saved");
  };
  const clear = () => { setDraft(blankDraft()); toast("Cleared"); };
  const open = (r: Rec) => { setDraft({ code: r.code, raw: fromThresholds(r.d), mask: { ...r.d.mask } }); go("enter"); toast(`Opened ${r.code || "record"}`); };
  const del = (id: string) => { if (confirmDel !== id) { setConfirmDel(id); return; } setRecs(r => r.filter(x => x.id !== id)); setConfirmDel(null); toast("Deleted"); };

  const print = () => printHTML(`<h2>Pure-tone audiometry report</h2><p>Client: <b>${esc(draft.code || "–")}</b>. Date: ${esc(fmtDate(new Date()))}.</p>
    <div style="max-width:430px">${audiogramSvg(d, 430)}</div>
    <table><tr><th></th><th>Right</th><th>Left</th></tr>
    <tr><td>PTA 0.5–4 kHz</td><td>${fmtAvg(R.p4)}</td><td>${fmtAvg(L.p4)}</td></tr><tr><td>PTA 0.5–2 kHz</td><td>${fmtAvg(R.p3)}</td><td>${fmtAvg(L.p3)}</td></tr>
    <tr><td>Mean air–bone gap</td><td>${R.abg ?? "–"}</td><td>${L.abg ?? "–"}</td></tr><tr><td>Type</td><td>${esc(TYPE_LABEL[R.type])}</td><td>${esc(TYPE_LABEL[L.type])}</td></tr></table>
    <p><b>WHO grade (better ear, WHO 2021):</b> ${esc(overall.grade?.g ?? "not calculable")}</p>
    <p style="font-size:9pt">Grades: WHO World Report on Hearing 2021. Symbols: ASHA 1990.</p><div class="sig"><div>Audiologist (name, RCI number)</div><div>Date</div></div>`);
  const csv = () => downloadCSV([["date", "client", ...(["R", "L"] as Ear[]).flatMap(e => AC_F.map(f => `AC_${e}_${f}`)), ...(["R", "L"] as Ear[]).flatMap(e => BC_F.map(f => `BC_${e}_${f}`)), "PTA4_R", "PTA4_L", "WHO_grade_better_ear"],
    ...recs.map(r => [r.date, r.code, ...(["R", "L"] as Ear[]).flatMap(e => AC_F.map(f => r.d.AC[e][f] ?? "")), ...(["R", "L"] as Ear[]).flatMap(e => BC_F.map(f => r.d.BC[e][f] ?? "")), r.pR ?? "", r.pL ?? "", r.grade ?? ""])], `audiograms-${todayISO()}.csv`);

  const contextQuery = overall.grade ? `${overall.grade.g} ${overall.unilateral ? "unilateral" : ""} ${[R.type, L.type].includes("mixed") || [R.type, L.type].includes("conductive") ? "air-bone gap conductive" : ""} ${[R, L].some(s => s.p4.why === "nr") ? "no response" : ""}`
    : [R, L].some(s => s.p4.why === "nr") ? "no response limit" : "";

  const GradeBox = (
    <div className="mt-4 rounded-lg border border-line bg-paper p-4" aria-live="polite">
      {overall.grade ? (
        <>
          <p className="m-0 text-[0.85rem] text-muted">WHO grade, better ear ({overall.better} dB HL)</p>
          <p className="m-0 text-2xl font-bold leading-tight">{overall.grade.g}</p>
          <p className="m-0 mt-2 text-[0.92rem]"><b>In quiet:</b> {overall.grade.quiet}. <b>In noise:</b> {overall.grade.noise}.</p>
          {overall.unilateral && <p className="m-0 mt-2 text-[0.92rem]">Better ear {overall.better} dB HL (below 20); worse ear {overall.worse} dB HL (35 or more).</p>}
        </>
      ) : (
        <p className="m-0 text-muted">Enter air conduction at 500, 1000, 2000 and 4000 Hz in both ears for the WHO grade.
          {overall.reason === "nr" && " A no-response at these frequencies means the average is at least as poor as the audiometer limit; record the grade clinically."}</p>
      )}
    </div>
  );

  return (
    <AppShell title={t("appName")} subtitle={t("appSub")} sections={sections} active={view} onSection={go}
      footer={<><p className="m-0">{t("disclaimer")}</p>
        <p className="m-0">Sources: World Health Organization. World report on hearing. Geneva: WHO; 2021. Olusanya BO, Davis AC, Hoffman HJ. Bull World Health Organ 2019;97(10):725–728. ASHA. Guidelines for audiometric symbols. 1990.</p></>}>

      {view === "enter" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel title="Thresholds (dB HL)">
            <label htmlFor="code" className="block text-[0.92rem] font-bold">Client code</label>
            <p className="m-0 text-[0.82rem] text-muted">Use a code, not a name.</p>
            <Input id="code" className="mt-1.5" maxLength={30} autoComplete="off" value={draft.code} onChange={e => setDraft(p => ({ ...p, code: e.target.value }))} />
            <p className="m-0 mt-3 text-[0.88rem] text-muted">Use − and + for 5 dB steps, or type a value from −10 to 120 (bone up to 80), or <b>NR</b> for no response. Leave blank if not tested.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Segmented label="Ear" value={ear} onChange={setEar} options={[{ value: "R", label: "Right ear" }, { value: "L", label: "Left ear" }]} />
              <div className="sm:hidden"><Segmented label="Conduction" value={cond} onChange={setCond} options={[{ value: "AC", label: "Air" }, { value: "BC", label: "Bone" }]} /></div>
            </div>
            <div className="mt-3"><EntryCard ear={ear} cond={cond} draft={draft} bad={bad} onRaw={onRaw} onMask={onMask} /></div>
            {bad.size > 0 && <p role="alert" className="m-0 mt-2 font-semibold text-high">Use multiples of 5 from −10 to 120 dB HL (bone up to 80), or NR.</p>}
            <div className="sticky bottom-16 z-10 -mx-4 mt-4 grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:flex lg:border-0 lg:bg-transparent lg:p-0">
              <Button variant="primary" onClick={save}>Save record</Button>
              <Button onClick={() => go("results")}>See results</Button>
              <Button variant="quiet" onClick={clear}>Clear</Button>
            </div>
          </Panel>
          <Panel title="Audiogram" className="hidden lg:block">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <SymbolKey />
            {GradeBox}
          </Panel>
        </div>
      )}

      {view === "chart" && (
        <Panel title="Audiogram" action={<Button size="sm" onClick={print}>Print report</Button>}>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          <SymbolKey />
        </Panel>
      )}

      {view === "results" && (
        <div className="grid gap-5">
          <Panel title="Results" action={<div className="flex gap-2"><Button size="sm" onClick={print}>Print report</Button><Button size="sm" variant="primary" onClick={save}>Save</Button></div>}>
            <div className="grid gap-3 md:grid-cols-2"><EarResult ear="R" s={R} /><EarResult ear="L" s={L} /></div>
            {GradeBox}
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">WHO grades of hearing loss (2021)</summary>
              <ResponsiveTable rowKey={w => w.id}
                rows={[...WHO, { id: "unilateral", g: "Unilateral", lo: NaN, hi: NaN, quiet: "Does not have problems unless sound is near the poorer ear", noise: "May have real difficulty following conversation" }]}
                columns={[
                  { header: "Grade", cell: w => <span className={cx(overall.grade?.id === w.id && "font-bold text-accent")}>{w.g}{overall.grade?.id === w.id && " (this result)"}</span> },
                  { header: "Better-ear average", cell: w => w.id === "unilateral" ? "Better ear < 20, worse ear 35 or more" : w.lo === -Infinity ? "< 20 dB HL" : w.hi === Infinity ? "95 dB HL or more" : `${w.lo} to < ${w.hi} dB HL` },
                  { header: "In quiet", cell: w => w.quiet }, { header: "In noise", cell: w => w.noise }]} />
              <p className="m-0 mt-2 text-[0.85rem] text-muted">Grades use the average of 500, 1000, 2000 and 4000 Hz in the better ear. Per-ear degree is shown above only as a description.</p>
            </details>
            <Callout tone="info">Type is a suggestion from the air–bone gap. Confirm with masking, immittance and the clinical picture.</Callout>
          </Panel>
          <References refs={refs} contextQuery={contextQuery} contextLabel="Why this result?" />
        </div>
      )}

      {view === "records" && (
        <div className="grid gap-5">
          <Panel title={`Saved records (${recs.length})`} action={<Button size="sm" onClick={csv} disabled={!recs.length}>Download CSV</Button>}>
            <ResponsiveTable rows={[...recs].reverse()} rowKey={r => r.id} empty="No saved records yet. Records stay on this device."
              columns={[
                { header: "Date", cell: r => fmtDate(r.date) }, { header: "Client", cell: r => r.code || "–" },
                { header: "Right PTA", cell: r => r.pR ?? "–", className: "tabular-nums" }, { header: "Left PTA", cell: r => r.pL ?? "–", className: "tabular-nums" },
                { header: "WHO grade", cell: r => r.grade ?? "–" },
                { header: "Actions", cell: r => <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => open(r)}>Open</Button>
                  <Button size="sm" variant="danger" onClick={() => del(r.id)}>{confirmDel === r.id ? "Tap again to delete" : "Delete"}</Button></div> }]} />
          </Panel>
          <Panel title={<span className="inline-flex items-center gap-2"><BookOpen className="h-5 w-5" aria-hidden />About this app</span>}>
            <p className="m-0 text-[0.95rem]">Averages, air–bone gaps and the WHO grade follow the World Report on Hearing (2021). The audiogram follows ASHA (1990) symbols and proportions. Records are stored in this browser only; download the CSV regularly as a backup.</p>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
