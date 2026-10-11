export type WeekStage = "V0_OPEN" | "V0_LOCKED" | "V1_OPEN" | "V1_LOCKED";

export function minutesReady(v0Minutes: number | null, v1Minutes: number | null): boolean {
  return (
    typeof v0Minutes === "number" &&
    typeof v1Minutes === "number" &&
    Number.isInteger(v0Minutes) &&
    v0Minutes > 0 &&
    v0Minutes === v1Minutes
  );
}

export function revisionSeconds(openedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - openedAt.getTime()) / 1000));
}

export function timeoutRecord(hasDraft: boolean):
  | { submissionStatus: "TIMED_OUT" }
  | { missingReason: "NOT_SUBMITTED"; completion: "MISSING" } {
  if (hasDraft) return { submissionStatus: "TIMED_OUT" };
  return { missingReason: "NOT_SUBMITTED", completion: "MISSING" };
}

export function pairedRevision(
  v0: string | null,
  v1: string | null,
): { v0: string; v1: string } | null {
  if (!v0 || !v1) return null;
  return { v0, v1 };
}

export function questionsLeft(
  row: { requestLimit: number; usedCount: number } | null,
  configuredLimit: number | null,
): number | null {
  if (row) return Math.max(0, row.requestLimit - row.usedCount);
  if (configuredLimit == null || configuredLimit < 1) return null;
  return configuredLimit;
}

export function quotaLimitFromEnv(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value.trim())) return null;
  return Number(value.trim());
}
