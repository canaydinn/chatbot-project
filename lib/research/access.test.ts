import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertNoResearchScores,
  assertStudentSessionShape,
  balancedSequences,
  blindedPlanPayload,
  decideAiAccess,
  observedScore,
  resolveAiPhase,
  studentSessionPayload,
} from "./access";

describe("yapay zeka erişimi", () => {
  const openRag = {
    role: "STUDENT",
    condition: "RAG_ASSISTED" as const,
    status: "ACTIVE" as const,
    consent: "ACCEPTED" as const,
    phase: "OPEN" as const,
    operation: "RAG" as const,
  };

  it("kontrol grubunu reddeder", () => {
    const decision = decideAiAccess({ ...openRag, condition: "CONTROL" });
    assert.equal(decision.allowed, false);
  });

  it("V0 aşamasında yapay zekayı kapatır", () => {
    const decision = decideAiAccess({ ...openRag, phase: "V0" });
    assert.equal(decision.allowed, false);
  });

  it("test aşamasında yapay zekayı kapatır", () => {
    assert.equal(decideAiAccess({ ...openRag, phase: "TEST" }).allowed, false);
  });

  it("araştırma çekilmesinden sonra yeni veriyi reddeder", () => {
    assert.equal(
      decideAiAccess({ ...openRag, status: "RESEARCH_WITHDRAWN" }).allowed,
      false,
    );
  });

  it("onamı olmayan öğrenciyi reddeder", () => {
    assert.equal(decideAiAccess({ ...openRag, consent: null }).allowed, false);
  });

  it("öğrenci olmayan rolün RAG ve gömme çağrısını reddeder", () => {
    assert.equal(decideAiAccess({ ...openRag, role: "INSTRUCTOR" }).allowed, false);
    assert.equal(
      decideAiAccess({ ...openRag, role: "ADMIN", operation: "EMBEDDING" }).allowed,
      false,
    );
    assert.equal(decideAiAccess({ ...openRag, role: "STUDENT" }).allowed, true);
    assert.equal(
      decideAiAccess({ ...openRag, role: "INSTRUCTOR", operation: "AI_FEEDBACK" }).allowed,
      true,
    );
  });

  it("V0/V1 haftasında revizyon açılmadan V0 döner", () => {
    assert.equal(resolveAiPhase({ v0v1Required: true, configuredPhase: "V0" }), "V0");
    assert.equal(
      resolveAiPhase({ v0v1Required: true, configuredPhase: "REVISION" }),
      "REVISION",
    );
  });
});

describe("gizli puan ve kör paket", () => {
  it("öğrenci oturumunda puan alanı bırakmaz", () => {
    const payload = studentSessionPayload({
      userId: "u1",
      email: "a@b.c",
      role: "INSTRUCTOR",
      aiCoachEnabled: true,
      coachPanel: false,
      activeWeek: 1,
      consent: "DECLINED",
      questionsRemaining: null,
    });
    assert.equal(payload.role, "INSTRUCTOR");
    assert.equal(payload.coachPanel, false);
    assert.equal(payload.questionsRemaining, null);
    assert.equal(payload.consent, "DECLINED");
    assertStudentSessionShape(payload);
    assertNoResearchScores(payload);
  });

  it("puan anahtarını yakalar", () => {
    assert.throws(() => assertNoResearchScores({ nested: { total_score: 10 } }));
  });

  it("kör pakette kimlik ve koşul yoktur", () => {
    const payload = blindedPlanPayload({ bolum: "metin" });
    assert.deepEqual(Object.keys(payload), ["content"]);
    assertNoResearchScores(payload);
  });

  it("eksik gözlemi sıfıra çevirmez", () => {
    assert.equal(observedScore({ completion: "MISSING", score: null }), null);
    assert.throws(() => observedScore({ completion: "MISSING", score: 0 }));
  });
});

describe("dizi ataması", () => {
  it("her koşulda AB ve BA sayılarını dengeler", () => {
    const assigned = balancedSequences(10, 42);
    for (const group of [assigned.control, assigned.rag]) {
      const ab = group.filter((item) => item === "AB").length;
      const ba = group.filter((item) => item === "BA").length;
      assert.equal(ab, 5);
      assert.equal(ba, 5);
    }
  });
});
