export type StudyCondition = "CONTROL" | "RAG_ASSISTED";

export type ParticipantStatus =
  | "ACTIVE"
  | "TEMPORARILY_INACTIVE"
  | "COURSE_WITHDRAWN"
  | "RESEARCH_WITHDRAWN"
  | "COMPLETED";

export type AiPhase = "V0" | "REVISION" | "OPEN" | "TEST";

export type AiOperation = "RAG" | "EMBEDDING" | "AI_FEEDBACK";

export type AccessDecision = {
  allowed: boolean;
  reason: string;
};

const CLOSED_STATUSES: ReadonlySet<ParticipantStatus> = new Set([
  "TEMPORARILY_INACTIVE",
  "COURSE_WITHDRAWN",
  "RESEARCH_WITHDRAWN",
  "COMPLETED",
]);

export function resolveAiPhase(input: {
  v0v1Required: boolean;
  configuredPhase: "V0" | "REVISION" | "TEST";
}): AiPhase {
  if (input.configuredPhase === "TEST") return "TEST";
  if (!input.v0v1Required) return "OPEN";
  return input.configuredPhase === "REVISION" ? "REVISION" : "V0";
}

export function decideAiAccess(input: {
  condition: StudyCondition | null;
  status: ParticipantStatus | null;
  consent: "ACCEPTED" | "DECLINED" | "WITHDRAWN" | null;
  phase: AiPhase;
  operation: AiOperation;
}): AccessDecision {
  if (input.phase === "V0" || input.phase === "TEST") {
    return { allowed: false, reason: "Bu aşamada yapay zeka kapalı." };
  }
  if (input.consent !== "ACCEPTED") {
    return { allowed: false, reason: "Araştırma onamı yok." };
  }
  if (!input.status || CLOSED_STATUSES.has(input.status)) {
    return { allowed: false, reason: "Katılımcı durumu yeni araştırma verisine kapalı." };
  }
  if (input.condition !== "RAG_ASSISTED") {
    return { allowed: false, reason: "Kontrol grubunun yapay zeka erişimi yok." };
  }
  return { allowed: true, reason: "RAG yardımcısı açık." };
}

const STUDENT_SESSION_KEYS = [
  "userId",
  "email",
  "role",
  "aiCoachEnabled",
  "coachPanel",
  "activeWeek",
  "consent",
  "questionsRemaining",
] as const;

export type StudentSession = {
  userId: string;
  email: string;
  role: string;
  aiCoachEnabled: boolean;
  coachPanel: boolean;
  activeWeek: number | null;
  consent: "ACCEPTED" | "DECLINED" | "WITHDRAWN" | null;
  questionsRemaining: null;
};

export function studentSessionPayload(input: StudentSession): StudentSession {
  return {
    userId: input.userId,
    email: input.email,
    role: "STUDENT",
    aiCoachEnabled: input.aiCoachEnabled,
    coachPanel: input.coachPanel,
    activeWeek: input.activeWeek,
    consent: input.consent,
    questionsRemaining: null,
  };
}

export function assertStudentSessionShape(value: Record<string, unknown>): void {
  const keys = Object.keys(value).sort();
  const expected = [...STUDENT_SESSION_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error("Öğrenci oturum yanıtı izin verilen alanların dışına çıktı.");
  }
}

const SCORE_KEY = /score|puan|criterion|weighted|rationale_score/i;

export function assertNoResearchScores(value: unknown): void {
  walk(value, "$");
}

function walk(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SCORE_KEY.test(key)) {
      throw new Error(`Gizli puan alanı yanıtta: ${path}.${key}`);
    }
    walk(child, `${path}.${key}`);
  }
}

export function blindedPlanPayload(content: unknown): { content: unknown } {
  return { content };
}

export function observedScore(record: {
  completion: "SUBMITTED" | "MISSING";
  score: number | null;
}): number | null {
  if (record.completion === "MISSING") {
    if (record.score !== null) {
      throw new Error("Eksik gözleme puan yazılamaz.");
    }
    return null;
  }
  return record.score;
}

export type SequenceAssignment = "AB" | "BA";

export function balancedSequences(countPerCondition: number, seed: number): {
  control: SequenceAssignment[];
  rag: SequenceAssignment[];
} {
  return {
    control: alternate(countPerCondition, seed),
    rag: alternate(countPerCondition, seed + 1),
  };
}

function alternate(count: number, seed: number): SequenceAssignment[] {
  const startWithAb = mulberry32(seed)() < 0.5;
  return Array.from({ length: count }, (_, index) => {
    const ab = startWithAb ? index % 2 === 0 : index % 2 === 1;
    return ab ? "AB" : "BA";
  });
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
