import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertNoResearchScores } from "./access";
import {
  minutesReady,
  pairedRevision,
  questionsLeft,
  quotaLimitFromEnv,
  revisionSeconds,
  timeoutRecord,
} from "./stages";

describe("V0 ve V1 süresi", () => {
  it("boş veya eşit olmayan dakikada aşama açmaz", () => {
    assert.equal(minutesReady(null, null), false);
    assert.equal(minutesReady(10, null), false);
    assert.equal(minutesReady(10, 15), false);
    assert.equal(minutesReady(10, 10), true);
  });

  it("süreyi sunucu anları arasındaki saniye olarak hesaplar", () => {
    const opened = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-01T00:01:30.000Z");
    assert.equal(revisionSeconds(opened, now), 90);
  });

  it("süre bitince taslağı kilitler, taslak yoksa eksik yazar ve puan üretmez", () => {
    const locked = timeoutRecord(true);
    const missing = timeoutRecord(false);
    assert.equal("submissionStatus" in locked && locked.submissionStatus, "TIMED_OUT");
    assert.equal("score" in locked, false);
    assert.deepEqual(missing, { missingReason: "NOT_SUBMITTED", completion: "MISSING" });
    assertNoResearchScores(locked);
    assertNoResearchScores(missing);
  });

  it("V0 veya V1 eksikse fark döndürmez", () => {
    assert.equal(pairedRevision(null, "ikinci"), null);
    assert.equal(pairedRevision("ilk", null), null);
    assert.equal(pairedRevision("", "ikinci"), null);
    assert.deepEqual(pairedRevision("ilk", "ikinci"), { v0: "ilk", v1: "ikinci" });
  });

  it("kota ayarı yoksa sayı uydurmaz", () => {
    assert.equal(quotaLimitFromEnv(undefined), null);
    assert.equal(quotaLimitFromEnv("  "), null);
    assert.equal(questionsLeft(null, null), null);
    assert.equal(questionsLeft(null, 4), 4);
    assert.equal(questionsLeft({ requestLimit: 4, usedCount: 3 }, null), 1);
  });
});
