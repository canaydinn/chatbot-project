import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  decideAiAccess,
  resolveAiPhase,
  studentSessionPayload,
  type AiOperation,
  type ParticipantStatus,
  type StudentSession,
  type StudyCondition,
} from "@/lib/research/access";

type Consent = "ACCEPTED" | "DECLINED" | "WITHDRAWN";

export type Actor = {
  userId: string;
  email: string;
  role: string;
  researchCode: string | null;
  condition: StudyCondition | null;
  status: ParticipantStatus | null;
  consent: Consent | null;
  phase: ReturnType<typeof resolveAiPhase>;
  activeWeek: number | null;
};

export async function readActor(): Promise<Actor | null> {
  const supabase = await createServerSupabase();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims.sub;
  if (claims.error || !userId) return null;

  const admin = createAdminSupabase();
  const profile = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", userId)
    .maybeSingle();
  if (profile.error || !profile.data) return null;

  const link = await admin
    .from("research_identity_map")
    .select("research_code")
    .eq("user_id", userId)
    .maybeSingle();
  if (link.error) throw new Error(link.error.message);
  const researchCode = link.data?.research_code ?? null;

  let condition: StudyCondition | null = null;
  let status: ParticipantStatus | null = null;
  if (researchCode) {
    const participant = await admin
      .from("participants")
      .select("study_condition, status")
      .eq("research_code", researchCode)
      .maybeSingle();
    if (participant.error) throw new Error(participant.error.message);
    if (participant.data?.study_condition === "CONTROL" || participant.data?.study_condition === "RAG_ASSISTED") {
      condition = participant.data.study_condition;
    }
    if (isStatus(participant.data?.status)) status = participant.data.status;
  }

  const consentEvent = await admin
    .from("consents")
    .select("decision")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consentEvent.error) throw new Error(consentEvent.error.message);

  const activeWeekRow = await admin
    .from("weeks")
    .select("week_number, is_v0_v1")
    .eq("is_active", true)
    .maybeSingle();
  if (activeWeekRow.error) throw new Error(activeWeekRow.error.message);

  const activeWeek = activeWeekRow.data?.week_number ?? null;
  const consent = isConsent(consentEvent.data?.decision) ? consentEvent.data.decision : null;

  return {
    userId,
    email: profile.data.email,
    role: profile.data.role,
    researchCode,
    condition,
    status,
    consent,
    phase: resolveAiPhase({
      v0v1Required: activeWeek == null || activeWeekRow.data?.is_v0_v1 === true,
      configuredPhase: "V0",
    }),
    activeWeek,
  };
}

export function sessionForStudent(actor: Actor): StudentSession {
  const decision = decideAiAccess({
    role: actor.role,
    condition: actor.condition,
    status: actor.status,
    consent: actor.consent,
    phase: actor.phase,
    operation: "RAG",
  });
  return studentSessionPayload({
    userId: actor.userId,
    email: actor.email,
    role: actor.role,
    aiCoachEnabled: actor.role === "STUDENT" && decision.allowed,
    coachPanel: actor.condition === "RAG_ASSISTED",
    activeWeek: actor.activeWeek,
    consent: actor.consent,
    questionsRemaining: null,
  });
}

export function gateOperation(actor: Actor, operation: AiOperation) {
  return decideAiAccess({
    role: actor.role,
    condition: actor.condition,
    status: actor.status,
    consent: actor.consent,
    phase: actor.phase,
    operation,
  });
}

function isStatus(value: unknown): value is ParticipantStatus {
  return (
    value === "ACTIVE" ||
    value === "TEMPORARILY_INACTIVE" ||
    value === "COURSE_WITHDRAWN" ||
    value === "RESEARCH_WITHDRAWN" ||
    value === "COMPLETED"
  );
}

function isConsent(value: unknown): value is Consent {
  return value === "ACCEPTED" || value === "DECLINED" || value === "WITHDRAWN";
}
