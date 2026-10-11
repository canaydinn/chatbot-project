"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function DosyaYukleme() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [excerpt, setExcerpt] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStatus("loading");
    setMessage("");
    setExcerpt("");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/student/file", { method: "POST", body });
      const data: unknown = await response.json().catch(() => null);
      const record = data && typeof data === "object" ? (data as { error?: unknown; text?: unknown; fileName?: unknown }) : {};
      if (!response.ok) {
        setStatus("error");
        setMessage(
          typeof record.error === "string"
            ? record.error
            : "Dosyadan metin çıkarılamadı. Dosyayı kontrol edip yeniden deneyin.",
        );
        return;
      }
      const text = typeof record.text === "string" ? record.text : "";
      setStatus("done");
      setExcerpt(text.slice(0, 600));
      setMessage(
        typeof record.fileName === "string"
          ? `${record.fileName} okundu.`
          : "Dosya okundu.",
      );
    } catch {
      setStatus("error");
      setMessage("Sunucuya bağlanılamadı. Bağlantınızı kontrol edip yeniden deneyin.");
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold">İş planı dosyası</h2>
      <p className="mt-1 text-sm text-stone-600">
        Bölüm metnini .txt, .pdf veya .docx olarak yükleyin. Metin çıkmazsa nedeni burada görünür.
      </p>
      <label className="mt-4 flex cursor-pointer flex-col items-start gap-2 text-sm">
        <span className="font-medium">Dosya seçin</span>
        <input
          type="file"
          accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="w-full text-base"
          disabled={status === "loading"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            void onFile(file);
            event.target.value = "";
          }}
        />
      </label>
      {status === "loading" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-stone-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Metin çıkarılıyor…
        </p>
      )}
      {message && status !== "loading" && (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            status === "error" ? "border border-red-200 bg-red-50 text-red-800" : "bg-stone-100 text-stone-800"
          }`}
        >
          {message}
        </p>
      )}
      {excerpt && (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
          {excerpt}
        </pre>
      )}
    </section>
  );
}
