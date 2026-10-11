export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

export async function extractUploadedText(file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

  if (ext === ".txt") {
    return assertExtractedText(await file.text());
  }

  if (!ext) {
    throw new ExtractionError(
      "Dosya adında uzantı yok. .txt, .pdf veya .docx yükleyin.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return assertExtractedText(result.value);
  }

  if (ext === ".pdf") {
    const nodePath = await import("path");
    const { pathToFileURL } = await import("url");
    const { PDFParse } = await import("pdf-parse");
    let pdfParseDir: string;
    try {
      pdfParseDir = nodePath.dirname(require.resolve("pdf-parse"));
    } catch {
      pdfParseDir = nodePath.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/cjs");
    }
    const workerUrl = pathToFileURL(nodePath.join(pdfParseDir, "pdf.worker.mjs")).href;
    PDFParse.setWorker(workerUrl);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return assertExtractedText(result.text || "");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "PDF okunamadı.";
      throw new ExtractionError(`PDF içinden metin çıkarılamadı. ${detail}`);
    } finally {
      await parser.destroy();
    }
  }

  throw new ExtractionError(
    `Bu dosya türü okunamadı (${ext}). .txt, .pdf veya .docx yükleyin.`,
  );
}

export function assertExtractedText(text: string): string {
  if (!text.trim()) {
    throw new ExtractionError(
      "Dosyadan metin çıkarılamadı. Dosya boş olabilir veya yalnızca görüntü içeriyor olabilir.",
    );
  }
  return text;
}
