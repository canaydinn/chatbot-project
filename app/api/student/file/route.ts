import { NextResponse } from "next/server";
import { ExtractionError, extractUploadedText } from "@/lib/files/extract";
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
