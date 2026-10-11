import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { studentActor } from "@/lib/student/http";
import { seal } from "@/lib/student/view";

export const dynamic = "force-dynamic";

const PLACEHOLDER_VERSION = "YER_TUTUCU";

export async function POST(request: Request) {
  const gate = await studentActor();
  if (gate.error) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "İstek okunamadı." }, { status: 400 });
  }
  const decision =
    body && typeof body === "object" ? (body as { decision?: unknown }).decision : null;
  if (decision !== "ACCEPTED" && decision !== "DECLINED") {
    return NextResponse.json({ error: "Onam kararı geçersiz." }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    const inserted = await admin.from("consents").insert({
      user_id: gate.actor.userId,
      document_version: PLACEHOLDER_VERSION,
      decision,
    });
    if (inserted.error) {
      const blocked = inserted.error.message.includes("Etik ayarları");
      return NextResponse.json(
        seal({
          saved: false,
          decision,
          message: blocked
            ? "Onam kaydı yazılamadı. Etik onay bilgileri henüz dolu değil. Derse devam edebilirsiniz."
            : "Onam kaydı yazılamadı. Derse devam edebilirsiniz.",
        }),
      );
    }
    return NextResponse.json(
      seal({
        saved: true,
        decision,
        message:
          decision === "DECLINED"
            ? "Katılmama kararınız kaydedildi. Derse devam edebilirsiniz."
            : "Katılma kararınız kaydedildi.",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onam kaydı yazılamadı.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
