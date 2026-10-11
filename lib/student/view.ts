import {
  assertNoResearchScores,
  assertStudentSessionShape,
  studentSessionPayload,
  type StudentSession,
} from "@/lib/research/access";

const SCORE_KEY = /score|puan|criterion|weighted|rationale_score/i;

export type FeedbackCard = {
  strengths: string | null;
  missingEvidence: string | null;
  unsupportedAssumption: string | null;
  inconsistency: string | null;
  suggestedRevision: string | null;
};

export type VersionKind = "V0" | "V1" | "FINAL";

export function emptyFeedback(): FeedbackCard {
  return {
    strengths: null,
    missingEvidence: null,
    unsupportedAssumption: null,
    inconsistency: null,
    suggestedRevision: null,
  };
}

function keepTextFields(input: unknown, allowedIds: ReadonlySet<string>): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SCORE_KEY.test(key) || !allowedIds.has(key) || typeof value !== "string") continue;
    fields[key] = value;
  }
  return fields;
}

export function sanitizeFields(
  input: unknown,
  allowedIds: ReadonlySet<string>,
): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Form alanları nesne olmalı.");
  }
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SCORE_KEY.test(key)) {
      throw new Error("Formda puan alanı kabul edilmez.");
    }
    if (!allowedIds.has(key)) continue;
    if (typeof value !== "string") {
      throw new Error("Form alanı metin olmalı.");
    }
    fields[key] = value;
  }
  return fields;
}

export function textFromContent(content: unknown): string {
  const parts: string[] = [];
  collectText(content, parts);
  return parts.join("\n\n").trim();
}

function collectText(value: unknown, parts: string[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) parts.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, parts));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SCORE_KEY.test(key)) continue;
    collectText(child, parts);
  }
}

export function summaryExcerpt(text: string, limit = 280): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit).trim()}…`;
}

export function nextVersionKind(existing: readonly VersionKind[]): "V0" | "V1" | null {
  if (!existing.includes("V0")) return "V0";
  if (!existing.includes("V1")) return "V1";
  return null;
}

export function taskFromLabels(labels: readonly string[]): string | null {
  const clean = labels.map((label) => label.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  return clean.join("\n");
}

export function pickVersionText(
  rows: readonly { versionKind: VersionKind; content: unknown }[],
  kind: "V0" | "V1",
): string | null {
  const row = rows.find((item) => item.versionKind === kind);
  if (!row) return null;
  const text = textFromContent(row.content);
  return text || null;
}

export function summaryForWeek(
  rows: readonly { versionKind: VersionKind; content: unknown }[],
): string {
  const preferred = (["V1", "V0", "FINAL"] as const)
    .map((kind) => rows.find((row) => row.versionKind === kind))
    .find(Boolean);
  if (!preferred) return "";
  return summaryExcerpt(textFromContent(preferred.content));
}

export function seal<T>(value: T): T {
  assertNoResearchScores(value);
  return value;
}

export type HomeView = {
  activeWeek: { weekNumber: number; title: string; task: string | null } | null;
  timeRemaining: null;
  previousWeeks: { weekNumber: number; title: string; summary: string }[];
  enrollmentNote: string | null;
};

export type WeekField = { id: string; position: number; label: string };

export type WeekView = {
  activeWeek: number | null;
  title: string | null;
  task: string | null;
  fields: WeekField[];
  draft: Record<string, string> | null;
  versions: { v0: string | null; v1: string | null };
  feedback: FeedbackCard;
  coachPanel: boolean;
  questionsRemaining: null;
  timeRemaining: null;
};

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readStudentSession(value: unknown): StudentSession {
  const row = asRecord(value, "Oturum yanıtı okunamadı.");
  const consent = row.consent;
  const payload = studentSessionPayload({
    userId: typeof row.userId === "string" ? row.userId : "",
    email: typeof row.email === "string" ? row.email : "",
    role: "STUDENT",
    aiCoachEnabled: row.aiCoachEnabled === true,
    coachPanel: row.coachPanel === true,
    activeWeek: typeof row.activeWeek === "number" ? row.activeWeek : null,
    consent:
      consent === "ACCEPTED" || consent === "DECLINED" || consent === "WITHDRAWN"
        ? consent
        : null,
    questionsRemaining: null,
  });
  assertStudentSessionShape(payload);
  return seal(payload);
}

export function readHomeView(value: unknown): HomeView {
  const row = asRecord(value, "Ana sayfa yanıtı okunamadı.");
  let activeWeek: HomeView["activeWeek"] = null;
  if (row.activeWeek && typeof row.activeWeek === "object") {
    const week = row.activeWeek as Record<string, unknown>;
    if (typeof week.weekNumber === "number" && typeof week.title === "string") {
      activeWeek = {
        weekNumber: week.weekNumber,
        title: week.title,
        task: asText(week.task),
      };
    }
  }
  const previousWeeks = Array.isArray(row.previousWeeks)
    ? row.previousWeeks.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const week = item as Record<string, unknown>;
        if (typeof week.weekNumber !== "number" || typeof week.title !== "string") return [];
        return [
          {
            weekNumber: week.weekNumber,
            title: week.title,
            summary: typeof week.summary === "string" ? week.summary : "",
          },
        ];
      })
    : [];
  return seal({
    activeWeek,
    timeRemaining: null,
    previousWeeks,
    enrollmentNote: asText(row.enrollmentNote),
  });
}

export function readWeekView(value: unknown): WeekView {
  const row = asRecord(value, "Hafta yanıtı okunamadı.");
  const fields = Array.isArray(row.fields)
    ? row.fields.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const field = item as Record<string, unknown>;
        if (
          typeof field.id !== "string" ||
          typeof field.position !== "number" ||
          typeof field.label !== "string" ||
          SCORE_KEY.test(field.id)
        ) {
          return [];
        }
        return [{ id: field.id, position: field.position, label: field.label }];
      })
    : [];
  const allowed = new Set(fields.map((field) => field.id));
  const draft =
    row.draft && typeof row.draft === "object" ? keepTextFields(row.draft, allowed) : null;
  const versions = asRecord(row.versions ?? {}, "Sürüm yanıtı okunamadı.");
  const feedback = asRecord(row.feedback ?? {}, "Geri bildirim yanıtı okunamadı.");
  const card = emptyFeedback();
  for (const key of Object.keys(card) as (keyof FeedbackCard)[]) {
    const text = feedback[key];
    card[key] = typeof text === "string" ? text : null;
  }
  return seal({
    activeWeek: typeof row.activeWeek === "number" ? row.activeWeek : null,
    title: asText(row.title),
    task: asText(row.task),
    fields,
    draft,
    versions: {
      v0: asText(versions.v0),
      v1: asText(versions.v1),
    },
    feedback: card,
    coachPanel: row.coachPanel === true,
    questionsRemaining: null,
    timeRemaining: null,
  });
}
