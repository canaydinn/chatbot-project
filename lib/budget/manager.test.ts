import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BudgetManager } from "./manager";

describe("bütçe yöneticisi", () => {
  it("rezervasyonu gerçek maliyetle kapatır ve kalanı serbest bırakır", async () => {
    const budget = new BudgetManager(1_000_000n, {
      RAG: 1_000_000n,
      WEEKLY_EVAL: 0n,
      TRANSFER_EVAL: 0n,
      FINAL_EVAL: 0n,
      CONTINGENCY: 0n,
    });
    const reservation = await budget.reserve({
      category: "RAG",
      modelId: "gpt-4o-mini",
      billingMode: "STANDARD",
      maxInputTokens: 1_000_000,
      maxOutputTokens: 0,
      idempotencyKey: "a",
    });
    assert.equal(reservation.reservedMicroUsd, 150_000n);
    await budget.reconcile({
      reservationId: reservation.id,
      inputTokens: 1_000,
      outputTokens: 0,
      billingMode: "STANDARD",
    });
    assert.equal(budget.available("RAG"), 1_000_000n - 150n);
  });

  it("eşzamanlı istekler tavanı aşmaz", async () => {
    const budget = new BudgetManager(200_000n, {
      RAG: 200_000n,
      WEEKLY_EVAL: 0n,
      TRANSFER_EVAL: 0n,
      FINAL_EVAL: 0n,
      CONTINGENCY: 0n,
    });
    const results = await Promise.allSettled([
      budget.reserve({
        category: "RAG",
        modelId: "gpt-4o-mini",
        billingMode: "STANDARD",
        maxInputTokens: 1_000_000,
        maxOutputTokens: 0,
        idempotencyKey: "one",
      }),
      budget.reserve({
        category: "RAG",
        modelId: "gpt-4o-mini",
        billingMode: "STANDARD",
        maxInputTokens: 1_000_000,
        maxOutputTokens: 0,
        idempotencyKey: "two",
      }),
    ]);
    const fulfilled = results.filter((item) => item.status === "fulfilled");
    assert.equal(fulfilled.length, 1);
  });

  it("aynı tekillik anahtarını ikinci kez ücretlendirmez", async () => {
    const budget = new BudgetManager();
    const first = await budget.reserve({
      category: "FINAL_EVAL",
      modelId: "gpt-5.4",
      billingMode: "BATCH",
      maxInputTokens: 1000,
      maxOutputTokens: 100,
      idempotencyKey: "plan-1",
    });
    const second = await budget.reserve({
      category: "FINAL_EVAL",
      modelId: "gpt-5.4",
      billingMode: "BATCH",
      maxInputTokens: 1000,
      maxOutputTokens: 100,
      idempotencyKey: "plan-1",
    });
    assert.equal(first.id, second.id);
  });

  it("bilinmeyen modeli reddeder", async () => {
    const budget = new BudgetManager();
    await assert.rejects(() =>
      budget.reserve({
        category: "RAG",
        modelId: "olmayan-model",
        billingMode: "STANDARD",
        maxInputTokens: 10,
        maxOutputTokens: 10,
        idempotencyKey: "x",
      }),
    );
  });

  it("acil durdurmadan sonra yeni rezervasyon almaz", async () => {
    const budget = new BudgetManager();
    budget.stop();
    await assert.rejects(() =>
      budget.reserve({
        category: "RAG",
        modelId: "gpt-4o-mini",
        billingMode: "STANDARD",
        maxInputTokens: 10,
        maxOutputTokens: 10,
        idempotencyKey: "stop",
      }),
    );
  });
});
