import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExtractionError, assertExtractedText, extractUploadedText } from "./extract";

describe("dosya metni", () => {
  it("metin dosyasını okur", async () => {
    const file = new File(["iş planı taslağı"], "plan.txt", { type: "text/plain" });
    assert.equal(await extractUploadedText(file), "iş planı taslağı");
  });

  it("boş dosyada açık hata verir", () => {
    assert.throws(
      () => assertExtractedText("  \n"),
      (error: unknown) =>
        error instanceof ExtractionError && error.message.includes("metin çıkarılamadı"),
    );
  });

  it("desteklenmeyen türde açık hata verir", async () => {
    const file = new File(["x"], "plan.png", { type: "image/png" });
    await assert.rejects(
      () => extractUploadedText(file),
      (error: unknown) => error instanceof ExtractionError && error.message.includes(".png"),
    );
  });
});
