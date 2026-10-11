import { NextResponse } from "next/server";
import type { Actor } from "@/lib/auth/actor";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { studentActor } from "@/lib/student/http";
import {
  emptyFeedback,
  nextVersionKind,
  pickVersionText,
  sanitizeFields,
  seal,
  taskFromLabels,
  type VersionKind,
} from "@/lib/student/view";

export const dynamic = "force-dynamic";

type FieldRow = { id: string; position: number; label: string };

export async function GET() {
  const gate = await studentActor();
  if (gate.error) return gate.error;
  try {
    return NextResponse.json(await loadWeek(gate.actor));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hafta yüklenemedi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await studentActor();
  if (gate.error) return gate.error;
  const { actor } = gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "İstek okunamadı." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as { action?: unknown; fields?: unknown }) : {};
  if (record.action !== "draft" && record.action !== "submit") {
    return NextResponse.json({ error: "Kayıt türü geçersiz." }, { status: 400 });
  }

  if (actor.activeWeek == null) {
    return NextResponse.json(
      { error: "Aktif hafta yok. Form kaydı için bir haftanın açılması gerekir." },
      { status: 409 },
    );
  }

  try {
    const admin = createAdminSupabase();
    const fieldRows = await loadFields(admin, actor.activeWeek);
    const fields = sanitizeFields(record.fields, new Set(fieldRows.map((field) => field.id)));

    if (!actor.researchCode) {
      const message =
        record.action === "submit"
          ? "Gönderim yazılamadı. Araştırma kaydı henüz yok. Metin bu cihazda duruyor."
          : "Araştırma kaydı henüz yok. Taslak bu cihazda duruyor.";
      return NextResponse.json(seal({ stored: false, message }));
    }

    if (record.action === "draft") {
      const inserted = await admin.from("events").insert({
        research_code: actor.researchCode,
        week_number: actor.activeWeek,
        event_type: "FORM_DRAFT",
        message: JSON.stringify({ fields }),
      });
      if (inserted.error) throw new Error(inserted.error.message);
      return NextResponse.json(seal({ stored: true, message: "Taslak kaydedildi." }));
    }

    const existing = await admin
      .from("submissions")
      .select("version_kind")
      .eq("research_code", actor.researchCode)
      .eq("week_number", actor.activeWeek);
    if (existing.error) throw new Error(existing.error.message);
    const kinds = (existing.data ?? [])
      .map((row) => row.version_kind)
      .filter((kind): kind is VersionKind => kind === "V0" || kind === "V1" || kind === "FINAL");
    const versionKind = nextVersionKind(kinds);
    if (!versionKind) {
      return NextResponse.json(
        {
          error:
            "Bu hafta için iki metin de kayıtlı. Bu aşamada kayıt değiştirilmez.",
        },
        { status: 409 },
      );
    }

    const inserted = await admin.from("submissions").insert({
      research_code: actor.researchCode,
      week_number: actor.activeWeek,
      version_kind: versionKind,
      content: { fields },
      rubric_version: "UNSET",
    });
    if (inserted.error) throw new Error(inserted.error.message);
    return NextResponse.json(
      seal({ stored: true, versionKind, message: `${versionKind} gönderildi.` }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Form kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loadFields(
  admin: ReturnType<typeof createAdminSupabase>,
  weekNumber: number,
): Promise<FieldRow[]> {
  const fields = await admin
    .from("weekly_form_fields")
    .select("id, position, label")
    .eq("week_number", weekNumber)
    .order("position");
  if (fields.error) throw new Error(fields.error.message);
  return fields.data ?? [];
}

async function loadWeek(actor: Actor) {
  const admin = createAdminSupabase();
  let title: string | null = null;
  let fields: FieldRow[] = [];
  if (actor.activeWeek != null) {
    const week = await admin
      .from("weeks")
      .select("title")
      .eq("week_number", actor.activeWeek)
      .maybeSingle();
    if (week.error) throw new Error(week.error.message);
    title = week.data?.title ?? null;
    fields = await loadFields(admin, actor.activeWeek);
  }

  let draft: Record<string, string> | null = null;
  const versions = { v0: null as string | null, v1: null as string | null };
  if (actor.researchCode && actor.activeWeek != null) {
    const drafts = await admin
      .from("events")
      .select("message")
      .eq("research_code", actor.researchCode)
      .eq("week_number", actor.activeWeek)
      .eq("event_type", "FORM_DRAFT")
      .order("recorded_at", { ascending: false })
      .limit(1);
    if (drafts.error) throw new Error(drafts.error.message);
    draft = parseDraft(drafts.data?.[0]?.message, new Set(fields.map((field) => field.id)));

    const submissions = await admin
      .from("submissions")
      .select("version_kind, content")
      .eq("research_code", actor.researchCode)
      .eq("week_number", actor.activeWeek);
    if (submissions.error) throw new Error(submissions.error.message);
    const rows = (submissions.data ?? [])
      .filter(
        (row): row is { version_kind: VersionKind; content: unknown } =>
          row.version_kind === "V0" || row.version_kind === "V1" || row.version_kind === "FINAL",
      )
      .map((row) => ({ versionKind: row.version_kind, content: row.content }));
    versions.v0 = pickVersionText(rows, "V0");
    versions.v1 = pickVersionText(rows, "V1");
  }

  return seal({
    activeWeek: actor.activeWeek,
    title,
    task: taskFromLabels(fields.map((field) => field.label)),
    fields: fields.map((field) => ({
      id: field.id,
      position: field.position,
      label: field.label,
    })),
    draft,
    versions,
    feedback: emptyFeedback(),
    coachPanel: actor.condition === "RAG_ASSISTED",
    questionsRemaining: null as null,
    timeRemaining: null as null,
  });
}

function parseDraft(message: string | null | undefined, allowedIds: ReadonlySet<string>) {
  if (!message) return null;
  try {
    const parsed = JSON.parse(message) as { fields?: unknown };
    return sanitizeFields(parsed.fields ?? {}, allowedIds);
  } catch {
    return null;
  }
}
