import {
  type BillingMode,
  type BudgetCategory,
  CATEGORY_CAPS_MICRO_USD,
  estimateCostMicro,
  GLOBAL_CAP_MICRO_USD,
} from "./pricing";

export type Reservation = {
  id: string;
  category: BudgetCategory;
  modelId: string;
  reservedMicroUsd: bigint;
  status: "RESERVED" | "RECONCILED" | "RELEASED";
  idempotencyKey: string;
};

type Usage = {
  reservationId: string;
  actualMicroUsd: bigint;
};

export class BudgetManager {
  private readonly reservations = new Map<string, Reservation>();
  private readonly usage: Usage[] = [];
  private emergencyStop = false;
  private chain: Promise<unknown> = Promise.resolve();
  private sequence = 0;

  constructor(
    private readonly globalCapMicroUsd = GLOBAL_CAP_MICRO_USD,
    private readonly categoryCaps: Record<BudgetCategory, bigint> = {
      ...CATEGORY_CAPS_MICRO_USD,
    },
  ) {}

  stop(): void {
    this.emergencyStop = true;
  }

  async reserve(input: {
    category: BudgetCategory;
    modelId: string;
    billingMode: BillingMode;
    maxInputTokens: number;
    maxOutputTokens: number;
    idempotencyKey: string;
  }): Promise<Reservation> {
    return this.exclusive(async () => {
      const existing = [...this.reservations.values()].find(
        (item) => item.idempotencyKey === input.idempotencyKey,
      );
      if (existing) return existing;
      if (this.emergencyStop) {
        throw new Error("Acil durdurma açık. Yeni ücretli istek yok.");
      }
      const cost = estimateCostMicro({
        modelId: input.modelId,
        billingMode: input.billingMode,
        inputTokens: input.maxInputTokens,
        outputTokens: input.maxOutputTokens,
      });
      if (cost > this.available(input.category)) {
        throw new Error("Bütçe yetersiz.");
      }
      const reservation: Reservation = {
        id: `res_${++this.sequence}`,
        category: input.category,
        modelId: input.modelId,
        reservedMicroUsd: cost,
        status: "RESERVED",
        idempotencyKey: input.idempotencyKey,
      };
      this.reservations.set(reservation.id, reservation);
      return reservation;
    });
  }

  async reconcile(input: {
    reservationId: string;
    inputTokens: number;
    outputTokens: number;
    billingMode: BillingMode;
  }): Promise<void> {
    return this.exclusive(async () => {
      const reservation = this.reservations.get(input.reservationId);
      if (!reservation || reservation.status !== "RESERVED") {
        throw new Error("Açık rezervasyon yok.");
      }
      const actual = estimateCostMicro({
        modelId: reservation.modelId,
        billingMode: input.billingMode,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      });
      if (actual > reservation.reservedMicroUsd) {
        throw new Error("Gerçek maliyet rezervasyonu aşıyor. Yeni istek durdurulmalı.");
      }
      reservation.status = "RECONCILED";
      this.usage.push({ reservationId: reservation.id, actualMicroUsd: actual });
    });
  }

  available(category: BudgetCategory): bigint {
    const globalLeft = this.globalCapMicroUsd - this.committed();
    const categoryLeft = this.categoryCaps[category] - this.committed(category);
    return globalLeft < categoryLeft ? globalLeft : categoryLeft;
  }

  private committed(category?: BudgetCategory): bigint {
    let reserved = 0n;
    for (const reservation of this.reservations.values()) {
      if (reservation.status !== "RESERVED") continue;
      if (category && reservation.category !== category) continue;
      reserved += reservation.reservedMicroUsd;
    }
    let spent = 0n;
    for (const event of this.usage) {
      const reservation = this.reservations.get(event.reservationId);
      if (category && reservation?.category !== category) continue;
      spent += event.actualMicroUsd;
    }
    return reserved + spent;
  }

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
