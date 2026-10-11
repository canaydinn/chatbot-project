import { createAdminSupabase } from "@/lib/supabase/admin";
import { quotaLimitFromEnv } from "@/lib/research/stages";

export async function syncStage(code: string, week: number) {
  const admin = createAdminSupabase();
  const closed = await admin.rpc("close_elapsed_stage", { p_code: code, p_week: week });
  if (closed.error) throw new Error(closed.error.message);
  const opened = await admin.rpc("open_v0_stage", { p_code: code, p_week: week });
  if (opened.error) throw new Error(opened.error.message);
}

export async function readStageClock(code: string, week: number) {
  const admin = createAdminSupabase();
  const clock = await admin.rpc("stage_clock", { p_code: code, p_week: week });
  if (clock.error) throw new Error(clock.error.message);
  const row = clock.data as {
    stage?: string | null;
    seconds_remaining?: number | null;
    minutes_ready?: boolean;
    is_v0_v1?: boolean;
  } | null;
  return {
    stage: row?.stage ?? null,
    secondsRemaining: typeof row?.seconds_remaining === "number" ? row.seconds_remaining : null,
    minutesReady: row?.minutes_ready === true,
    isV0V1: row?.is_v0_v1 === true,
  };
}

export async function recordSubmission(code: string, week: number, content: unknown, summary: string) {
  const admin = createAdminSupabase();
  const result = await admin.rpc("record_version_submission", {
    p_code: code,
    p_week: week,
    p_content: content,
    p_summary: summary,
  });
  if (result.error) throw new Error(result.error.message);
  return String(result.data);
}

export async function consumeWeeklyQuota(code: string, week: number) {
  const limit = quotaLimitFromEnv(process.env.MAX_RAG_REQUESTS_PER_STUDENT_PER_WEEK);
  if (limit == null) return { allowed: false as const, reason: "Soru hakkı ayarı yok." };
  const admin = createAdminSupabase();
  const result = await admin.rpc("consume_rag_quota", {
    p_code: code,
    p_week: week,
    p_limit: limit,
  });
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) return { allowed: false as const, reason: "Bu hafta soru hakkınız bitti." };
  return { allowed: true as const, remaining: result.data as number };
}

export async function logRagRequest(code: string, week: number, message: string) {
  const admin = createAdminSupabase();
  const inserted = await admin.from("events").insert({
    research_code: code,
    week_number: week,
    event_type: "RAG_REQUEST",
    message,
  });
  if (inserted.error) throw new Error(inserted.error.message);
}
