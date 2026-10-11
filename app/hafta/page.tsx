import { redirect } from "next/navigation";
import { ConfigMissing, MissingCode, requireResearchActor } from "../ogrenci/koruma";
import { HaftaFormu } from "./form";

export default async function HaftaPage() {
  const gate = await requireResearchActor();
  if (gate.kind === "config") return <ConfigMissing />;
  if (gate.kind === "login") redirect("/");
  if (gate.kind === "missing-code") return <MissingCode />;
  return <HaftaFormu />;
}
