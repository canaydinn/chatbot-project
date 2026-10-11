import { redirect } from "next/navigation";
import { ConfigMissing, MissingCode, requireResearchActor } from "../ogrenci/koruma";

export default async function ChatPage() {
  const gate = await requireResearchActor();
  if (gate.kind === "config") return <ConfigMissing />;
  if (gate.kind === "login") redirect("/");
  if (gate.kind === "missing-code") return <MissingCode />;
  redirect("/hafta");
}
