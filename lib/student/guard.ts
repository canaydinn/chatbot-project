export const NO_RESEARCH_CODE_MESSAGE =
  "Araştırma kodunuz yok. Haftalık form ve sohbet, araştırma kaydı olan öğrenciler içindir.";

export function studentPageGuard(
  actor: { researchCode: string | null } | null,
): "login" | "missing-code" | "ok" {
  if (!actor) return "login";
  if (!actor.researchCode) return "missing-code";
  return "ok";
}
