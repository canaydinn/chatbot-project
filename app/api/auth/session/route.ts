import { NextResponse } from "next/server";
import { readActor, sessionForStudent } from "@/lib/auth/actor";
import { assertNoResearchScores, assertStudentSessionShape } from "@/lib/research/access";

export async function GET() {
  try {
    const actor = await readActor();
    if (!actor) {
      return NextResponse.json({ error: "Oturum yok." }, { status: 401 });
    }
    const payload = sessionForStudent(actor);
    assertStudentSessionShape(payload);
    assertNoResearchScores(payload);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Oturum hizmeti yapılandırılmamış." }, { status: 503 });
  }
}
