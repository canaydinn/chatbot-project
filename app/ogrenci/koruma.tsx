import { readActor } from "@/lib/auth/actor";
import { NO_RESEARCH_CODE_MESSAGE, studentPageGuard } from "@/lib/student/guard";

export async function requireResearchActor() {
  try {
    const actor = await readActor();
    const decision = studentPageGuard(actor);
    if (decision === "login") return { kind: "login" as const };
    if (decision === "missing-code") return { kind: "missing-code" as const };
    return { kind: "ok" as const };
  } catch {
    return { kind: "config" as const };
  }
}

export function ConfigMissing() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p role="alert">Oturum hizmeti yapılandırılmamış.</p>
    </main>
  );
}

export function MissingCode() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Araştırma kodu yok</h1>
      <p className="mt-3 text-sm leading-6">{NO_RESEARCH_CODE_MESSAGE}</p>
    </main>
  );
}
