export type BillingMode = "STANDARD" | "BATCH";

export type ModelPrice = {
  modelId: string;
  billingMode: BillingMode;
  inputMicroUsdPerMillion: bigint;
  outputMicroUsdPerMillion: bigint;
};

// Resmi fiyatlar, 10 Ekim 2026, 272 bin girdi altı, önbellek yok.
// 1 USD = 1_000_000 mikro USD.
export const VERIFIED_PRICES: readonly ModelPrice[] = [
  { modelId: "gpt-5.4", billingMode: "STANDARD", inputMicroUsdPerMillion: 2_500_000n, outputMicroUsdPerMillion: 15_000_000n },
  { modelId: "gpt-5.4", billingMode: "BATCH", inputMicroUsdPerMillion: 1_250_000n, outputMicroUsdPerMillion: 7_500_000n },
  { modelId: "gpt-5.4-nano", billingMode: "STANDARD", inputMicroUsdPerMillion: 200_000n, outputMicroUsdPerMillion: 1_250_000n },
  { modelId: "gpt-4o-mini", billingMode: "STANDARD", inputMicroUsdPerMillion: 150_000n, outputMicroUsdPerMillion: 600_000n },
  { modelId: "claude-sonnet-5-5", billingMode: "STANDARD", inputMicroUsdPerMillion: 2_000_000n, outputMicroUsdPerMillion: 10_000_000n },
  { modelId: "claude-sonnet-5-5", billingMode: "BATCH", inputMicroUsdPerMillion: 1_000_000n, outputMicroUsdPerMillion: 5_000_000n },
  { modelId: "text-embedding-3-small", billingMode: "STANDARD", inputMicroUsdPerMillion: 20_000n, outputMicroUsdPerMillion: 0n },
];

export const GLOBAL_CAP_MICRO_USD = 50_000_000n;

export const CATEGORY_CAPS_MICRO_USD = {
  RAG: 30_000_000n,
  WEEKLY_EVAL: 6_000_000n,
  TRANSFER_EVAL: 4_000_000n,
  FINAL_EVAL: 6_000_000n,
  CONTINGENCY: 4_000_000n,
} as const;

export type BudgetCategory = keyof typeof CATEGORY_CAPS_MICRO_USD;

export function findPrice(modelId: string, billingMode: BillingMode): ModelPrice {
  const price = VERIFIED_PRICES.find(
    (item) => item.modelId === modelId && item.billingMode === billingMode,
  );
  if (!price) {
    throw new Error(`Fiyatı doğrulanmamış model: ${modelId} / ${billingMode}`);
  }
  return price;
}

export function estimateCostMicro(input: {
  modelId: string;
  billingMode: BillingMode;
  inputTokens: number;
  outputTokens: number;
}): bigint {
  if (!Number.isInteger(input.inputTokens) || !Number.isInteger(input.outputTokens)) {
    throw new Error("Belirteç sayıları tam sayı olmalı.");
  }
  if (input.inputTokens < 0 || input.outputTokens < 0) {
    throw new Error("Belirteç sayısı negatif olamaz.");
  }
  const price = findPrice(input.modelId, input.billingMode);
  return (
    ceilDiv(BigInt(input.inputTokens) * price.inputMicroUsdPerMillion, 1_000_000n) +
    ceilDiv(BigInt(input.outputTokens) * price.outputMicroUsdPerMillion, 1_000_000n)
  );
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (numerator === 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}
