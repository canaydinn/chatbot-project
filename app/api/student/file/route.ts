import { NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";
import { ExtractionError, extractUploadedText } from "@/lib/files/extract";
import { removeSearchPoints } from "@/lib/files/index";
import { studentActor } from "@/lib/student/http";
import { seal } from "@/lib/student/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await studentActor();
  if (gate.error) return gate.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Dosya isteği okunamadı." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Bir dosya seçin." }, { status: 400 });
  }

  try {
    const text = await extractUploadedText(file);
    return NextResponse.json(seal({ fileName: file.name, text }));
  } catch (error) {
    const message =
      error instanceof ExtractionError
        ? error.message
        : "Dosyadan metin çıkarılamadı. Dosyayı kontrol edip yeniden deneyin.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const gate = await studentActor();
  if (gate.error) return gate.error;
  if (!gate.actor.researchCode) {
    return NextResponse.json(
      { error: "Araştırma kodu yok. Arama dizini silinmedi. Gönderimler duruyor." },
      { status: 409 },
    );
  }
  if (!process.env.QDRANT_URL) {
    return NextResponse.json({ error: "Arama dizini hizmeti tanımlı değil." }, { status: 503 });
  }

  try {
    const client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });
    const result = await removeSearchPoints(
      { deleteCollection: (name) => client.deleteCollection(name) },
      gate.actor.researchCode,
    );
    return NextResponse.json(seal({ removed: true, submissions: result.submissions }));
  } catch (error) {
    console.error("Arama dizini silinemedi:", error);
    return NextResponse.json({ error: "Arama dizini silinemedi." }, { status: 500 });
  }
}
