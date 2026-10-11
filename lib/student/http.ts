import { NextResponse } from "next/server";
import { readActor, type Actor } from "@/lib/auth/actor";

export async function studentActor(): Promise<
  { actor: Actor; error: null } | { actor: null; error: NextResponse }
> {
  try {
    const actor = await readActor();
    if (!actor) {
      return {
        actor: null,
        error: NextResponse.json({ error: "Oturum yok." }, { status: 401 }),
      };
    }
    return { actor, error: null };
  } catch {
    return {
      actor: null,
      error: NextResponse.json(
        { error: "Oturum hizmeti yapılandırılmamış." },
        { status: 503 },
      ),
    };
  }
}
