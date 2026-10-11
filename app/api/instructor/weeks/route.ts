import { NextResponse } from "next/server";
import { readActor } from "@/lib/auth/actor";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LOCK_WEEKS = [1, 5, 9];

export async function GET() {
  const actor = await staff();
  if (actor instanceof NextResponse) return actor;
  const admin = createAdminSupabase();
  const weeks = await admin
    .from("weeks")
    .select("week_number, title, v0_minutes, v1_minutes")
    .in("week_number", LOCK_WEEKS)
    .order("week_number");
  if (weeks.error) {
    console.error(weeks.error);
    return NextResponse.json({ error: "Haftalar okunamadı." }, { status: 500 });
  }
  return NextResponse.json({ weeks: weeks.data ?? [] });
}

export async function POST(request: Request) {
  const actor = await staff();
  if (actor instanceof NextResponse) return actor;
  const body = (await request.json().catch(() => null)) as {
    weekNumber?: unknown;
    v0Minutes?: unknown;
    v1Minutes?: unknown;
  } | null;
  const weekNumber = body?.weekNumber;
  if (typeof weekNumber !== "number" || !LOCK_WEEKS.includes(weekNumber)) {
    return NextResponse.json({ error: "Yalnızca 1, 5 ve 9. haftalar." }, { status: 400 });
  }
  const v0 = minutes(body?.v0Minutes);
  const v1 = minutes(body?.v1Minutes);
  if (v0 === "bad" || v1 === "bad" || (v0 == null) !== (v1 == null) || (v0 != null && v0 !== v1)) {
    return NextResponse.json(
      { error: "İki süre birlikte boş bırakılır veya aynı pozitif dakika olarak yazılır." },
      { status: 400 },
    );
  }
  const admin = createAdminSupabase();
  const updated = await admin
    .from("weeks")
    .update({ v0_minutes: v0, v1_minutes: v1 })
    .eq("week_number", weekNumber);
  if (updated.error) {
    console.error(updated.error);
    return NextResponse.json({ error: "Süre kaydedilemedi." }, { status: 500 });
  }
  return NextResponse.json({ stored: true });
}

function minutes(value: unknown): number | null | "bad" {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return "bad";
  return value;
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
