import { describe, expect, it } from "vitest";
import { average, earSummary, emptyThresholds, overallGrade, parseThreshold, whoGrade, type Thresholds } from "./audiology";

const set = (d: Thresholds, k: "AC" | "BC", e: "R" | "L", vals: Record<number, number | "NR">) => { for (const [f, v] of Object.entries(vals)) d[k][e][f] = v; };

describe("WHO 2021 grade cut-offs", () => {
  it.each([[-10, "normal"], [19.9, "normal"], [20, "mild"], [34.9, "mild"], [35, "moderate"], [49.9, "moderate"], [50, "modsevere"],
    [64.9, "modsevere"], [65, "severe"], [79.9, "severe"], [80, "profound"], [94.9, "profound"], [95, "complete"], [120, "complete"]] as const)(
    "%s dB HL is %s", (v, id) => expect(whoGrade(v).id).toBe(id));
});

describe("threshold entry", () => {
  it("accepts multiples of 5 and NR", () => {
    expect(parseThreshold("35", "AC").value).toBe(35);
    expect(parseThreshold(" nr ", "AC").value).toBe("NR");
    expect(parseThreshold("", "AC")).toEqual({});
  });
  it("rejects out-of-range and non-5 steps", () => {
    expect(parseThreshold("33", "AC").error).toBe(true);
    expect(parseThreshold("-15", "AC").error).toBe(true);
    expect(parseThreshold("125", "AC").error).toBe(true);
    expect(parseThreshold("85", "BC").error).toBe(true);
    expect(parseThreshold("80", "BC").value).toBe(80);
  });
});

describe("averages", () => {
  it("rounds to one decimal", () => expect(average({ 500: 10, 1000: 15, 2000: 15, 4000: 25 }, [500, 1000, 2000, 4000]).val).toBe(16.3));
  it("is not calculable with a missing frequency", () => expect(average({ 500: 10 }, [500, 1000]).why).toBe("incomplete"));
  it("is not calculable with NR", () => expect(average({ 500: 10, 1000: "NR" }, [500, 1000]).why).toBe("nr"));
});

describe("worked case from the app's verification", () => {
  const d = emptyThresholds();
  set(d, "AC", "R", { 250: 20, 500: 30, 1000: 40, 2000: 50, 3000: 55, 4000: 60, 6000: 70, 8000: "NR" });
  set(d, "AC", "L", { 250: 10, 500: 10, 1000: 15, 2000: 15, 3000: 20, 4000: 25, 6000: 30, 8000: 35 });
  set(d, "BC", "R", { 250: 15, 500: 20, 1000: 35, 2000: 40, 3000: 50, 4000: 55 });
  const R = earSummary(d, "R"), L = earSummary(d, "L");
  it("right ear PTA 45, gap 7.5, sensorineural", () => { expect(R.p4.val).toBe(45); expect(R.abg).toBe(7.5); expect(R.type).toBe("sensorineural"); });
  it("left ear PTA 16.3, no loss", () => { expect(L.p4.val).toBe(16.3); expect(L.type).toBe("none"); });
  it("is unilateral", () => { const o = overallGrade(R, L); expect(o.unilateral).toBe(true); expect(o.grade?.id).toBe("unilateral"); });
});

describe("type and unilateral boundaries", () => {
  const ear = (ac: number, bc?: number) => { const d = emptyThresholds(); for (const f of [500, 1000, 2000, 4000]) { d.AC.R[f] = ac; if (bc != null) d.BC.R[f] = bc; } return earSummary(d, "R"); };
  it("gap of exactly 10 is sensorineural", () => expect(ear(40, 30).type).toBe("sensorineural"));
  it("gap of 15 with BC < 20 is conductive", () => expect(ear(30, 15).type).toBe("conductive"));
  it("gap of 15 with BC ≥ 20 is mixed", () => expect(ear(50, 35).type).toBe("mixed"));
  it("needs bone conduction to type a loss", () => expect(ear(40).type).toBe("needBC"));
  it("better 15, worse 35 is unilateral; worse 30 is not", () => {
    expect(overallGrade(ear(35), ear(15)).unilateral).toBe(true);
    const o = overallGrade(ear(30), ear(15)); expect(o.unilateral).toBe(false); expect(o.grade?.id).toBe("normal");
  });
  it("better 20 is graded mild, not unilateral", () => expect(overallGrade(ear(60), ear(20)).grade?.id).toBe("mild"));
});
