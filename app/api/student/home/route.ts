import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { studentActor } from "@/lib/student/http";
import {
  seal,
  summaryExcerpt,
  summaryForWeek,
  taskFromLabels,
  type VersionKind,
} from "@/lib/student/view";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await studentActor();
  if (gate.error) return gate.error;
  const { actor } = gate;

  try {
    const admin = createAdminSupabase();
    const weeksResult = await admin.from("weeks").select("week_number, title");
    if (weeksResult.error) throw new Error(weeksResult.error.message);

    const titles = new Map<number, string>();
    for (const row of weeksResult.data ?? []) {
      titles.set(row.week_number, row.title);
    }

    let task: string | null = null;
    if (actor.activeWeek != null) {
      const fields = await admin
        .from("weekly_form_fields")
        .select("label, position")
        .eq("week_number", actor.activeWeek)
        .order("position");
      if (fields.error) throw new Error(fields.error.message);
      task = taskFromLabels((fields.data ?? []).map((field) => field.label));
    }

    const previousWeeks: { weekNumber: number; title: string; summary: string }[] = [];
    if (actor.researchCode) {
      const submissions = await admin
        .from("submissions")
        .select("week_number, version_kind, content")
        .eq("research_code", actor.researchCode);
      if (submissions.error) throw new Error(submissions.error.message);

      const grouped = new Map<number, { versionKind: VersionKind; content: unknown }[]>();
      for (const row of submissions.data ?? []) {
        if (row.week_number === actor.activeWeek) continue;
        if (row.version_kind !== "V0" && row.version_kind !== "V1" && row.version_kind !== "FINAL") {
          continue;
        }
        const list = grouped.get(row.week_number) ?? [];
        list.push({ versionKind: row.version_kind, content: row.content });
        grouped.set(row.week_number, list);
      }

      for (const weekNumber of [...grouped.keys()].sort((a, b) => a - b)) {
        const summary = summaryExcerpt(summaryForWeek(grouped.get(weekNumber) ?? []));
        previousWeeks.push({
          weekNumber,
          title: titles.get(weekNumber) ?? `Hafta ${weekNumber}`,
          summary: summary || "Kayıtlı metin yok.",
        });
      }
    }

    const payload = seal({
      activeWeek:
        actor.activeWeek == null
          ? null
          : {
              weekNumber: actor.activeWeek,
              title: titles.get(actor.activeWeek) ?? `Hafta ${actor.activeWeek}`,
              task,
            },
      timeRemaining: null,
      previousWeeks,
      enrollmentNote: actor.researchCode
        ? null
        : "Araştırma kaydı henüz yok. Ders ekranları açık.",
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ana sayfa yüklenemedi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
