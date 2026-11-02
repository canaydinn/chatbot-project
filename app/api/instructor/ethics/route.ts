import { NextResponse } from "next/server";
import { readActor } from "@/lib/auth/actor";
import {
  ETHICS_FIELDS,
  emptyEthicsDraft,
  ethicsDraftFromRow,
  ethicsStoredFromDraft,
  type EthicsDraft,
} from "@/lib/research/ethics";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLUMNS =
  "board_name, approval_date, approval_number, protocol_version, consent_document_version, retention_period, data_controller, research_contact, research_starts_on, research_ends_on, authorized_processors, ai_providers, enrollment_open" as const;

export async function GET() {
  const actor = await staff();
  if (actor instanceof NextResponse) return actor;
  const admin = createAdminSupabase();
  const row = await admin.from("ethics_settings").select(COLUMNS).eq("id", 1).maybeSingle();
  if (row.error || !row.data) {
    console.error(row.error);
    return NextResponse.json({ error: "Etik ayarları okunamadı." }, { status: 500 });
  }
  return NextResponse.json({ settings: ethicsDraftFromRow(row.data) });
}

export async function POST(request: Request) {
  const actor = await staff();
  if (actor instanceof NextResponse) return actor;
  const body = (await request.json().catch(() => null)) as Partial<EthicsDraft> | null;
  const draft = emptyEthicsDraft();
  for (const field of ETHICS_FIELDS) {
    const value = body?.[field.key];
    if (typeof value !== "string") {
      return NextResponse.json({ error: "Etik alanları metin olarak gönderilir." }, { status: 400 });
    }
    draft[field.key] = value;
  }
  if (typeof body?.enrollment_open !== "boolean") {
    return NextResponse.json({ error: "Kayıt durumu seçilmedi." }, { status: 400 });
  }
  draft.enrollment_open = body.enrollment_open;
  const stored = ethicsStoredFromDraft(draft);
  if ("error" in stored) {
    return NextResponse.json({ error: stored.error }, { status: 400 });
  }
  const admin = createAdminSupabase();
  const updated = await admin
    .from("ethics_settings")
    .update(stored.row)
    .eq("id", 1)
    .select("id")
    .maybeSingle();
  if (updated.error || !updated.data) {
    console.error(updated.error);
    return NextResponse.json({ error: "Etik ayarları kaydedilemedi." }, { status: 500 });
  }
  return NextResponse.json({ stored: true, settings: ethicsDraftFromRow(stored.row) });
}

async function staff() {
  try {
    const actor = await readActor();
    if (!actor) return NextResponse.json({ error: "Oturum yok." }, { status: 401 });
    if (actor.role !== "INSTRUCTOR" && actor.role !== "ADMIN") {
      return NextResponse.json({ error: "Bu sayfa öğretim elemanı içindir." }, { status: 403 });
    }
    return actor;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Oturum hizmeti yapılandırılmamış." }, { status: 503 });
  }
}
