import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertNoResearchScores } from "../research/access";
import {
  emptyFeedback,
  nextVersionKind,
  pickVersionText,
  readHomeView,
  readStudentSession,
  readWeekView,
  sanitizeFields,
  summaryForWeek,
  taskFromLabels,
  textFromContent,
} from "./view";

describe("öğrenci görünümü", () => {
  it("puan anahtarını formdan ve metinden çıkarır", () => {
    const fields = sanitizeFields(
      { "field-1": "kanıt", ignored: "yok" },
      new Set(["field-1"]),
    );
    assert.deepEqual(fields, { "field-1": "kanıt" });
    assert.throws(() => sanitizeFields({ total_score: "1" }, new Set(["total_score"])));

    const text = textFromContent({
      fields: { a: "müşteri cümlesi" },
      total_score: 80,
      nested: { dimension_scores: { CYCLE_A: 4 }, note: "revizyon" },
    });
    assert.equal(text, "müşteri cümlesi\n\nrevizyon");
    assertNoResearchScores({ text });
  });

  it("nitel kartta sayı taşımaz", () => {
    const card = emptyFeedback();
    assert.deepEqual(Object.values(card), [null, null, null, null, null]);
    assertNoResearchScores(card);
  });

  it("sıradaki sürümü kilit penceresi olmadan seçer", () => {
    assert.equal(nextVersionKind([]), "V0");
    assert.equal(nextVersionKind(["V0"]), "V1");
    assert.equal(nextVersionKind(["V0", "V1"]), null);
  });

  it("görev metnini alan etiketlerinden kurar", () => {
    assert.equal(taskFromLabels(["  Problem  ", "Kanıt"]), "Problem\nKanıt");
    assert.equal(taskFromLabels(["  "]), null);
  });

  it("istemci okuyucusu puan alanını duruma almaz", () => {
    const session = readStudentSession({
      userId: "u1",
      email: "a@b.c",
      role: "INSTRUCTOR",
      aiCoachEnabled: false,
      coachPanel: false,
      activeWeek: null,
      consent: null,
      questionsRemaining: 4,
      total_score: 90,
    });
    assert.equal(session.role, "INSTRUCTOR");
    assert.equal(session.questionsRemaining, null);
    assert.equal(session.coachPanel, false);
    assert.equal("total_score" in session, false);

    const home = readHomeView({
      activeWeek: { weekNumber: 2, title: "Kanıt", task: "Gözlem", total_score: 1 },
      timeRemaining: 3,
      previousWeeks: [{ weekNumber: 1, title: "Problem", summary: "kısa", puan: 10 }],
      enrollmentNote: null,
    });
    assert.equal(home.timeRemaining, null);
    assert.equal(home.previousWeeks[0]?.summary, "kısa");
    assertNoResearchScores(home);

    const week = readWeekView({
      activeWeek: 2,
      title: "Kanıt",
      task: "Gözlem",
      fields: [{ id: "f1", position: 1, label: "Ne gördün?" }],
      draft: { f1: "not", total_score: "9" },
      versions: { v0: "ilk", v1: null, total_score: 3 },
      feedback: { strengths: "net örnek", total_score: 4 },
      coachPanel: true,
      questionsRemaining: 2,
    });
    assert.equal(week.coachPanel, true);
    assert.equal(week.questionsRemaining, null);
    assert.equal(week.draft?.f1, "not");
    assert.equal(week.feedback.strengths, "net örnek");
    assert.equal(week.versions.v0, "ilk");
    assertNoResearchScores(week);
  });

  it("özet ve sürüm metninde gizli anahtar bırakmaz", () => {
    const rows = [
      { versionKind: "V0" as const, content: { fields: { a: "ilk metin" }, total_score: 1 } },
      { versionKind: "V1" as const, content: { fields: { a: "revize metin" } } },
    ];
    assert.equal(pickVersionText(rows, "V0"), "ilk metin");
    assert.equal(summaryForWeek(rows), "revize metin");
    assertNoResearchScores({ v0: pickVersionText(rows, "V0"), summary: summaryForWeek(rows) });
  });
});
