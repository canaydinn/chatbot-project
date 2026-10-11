"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OgrenciKabugu, useOturum } from "../ogrenci/kabuk";

function OnamFormu() {
  const router = useRouter();
  const { session } = useOturum();
  const [pending, setPending] = useState<"ACCEPTED" | "DECLINED" | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function choose(decision: "ACCEPTED" | "DECLINED") {
    setPending(decision);
    setFailed(false);
    setMessage("");
    try {
      const response = await fetch("/api/student/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body: unknown = await response.json().catch(() => null);
      const record =
        body && typeof body === "object"
          ? (body as { message?: unknown; error?: unknown })
          : {};
      const text =
        typeof record.message === "string"
          ? record.message
          : typeof record.error === "string"
            ? record.error
            : "Karar kaydedilemedi.";
      setMessage(text);
      if (decision === "DECLINED") {
        router.push("/ana");
        return;
      }
      if (response.ok && body && typeof body === "object" && (body as { saved?: unknown }).saved === true) {
        router.push("/ana");
        return;
      }
      setFailed(true);
    } catch {
      setMessage("Sunucuya bağlanılamadı.");
      if (decision === "DECLINED") {
        router.push("/ana");
        return;
      }
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  const consentLabel =
    session?.consent === "ACCEPTED"
      ? "Kayıtlı kararınız: katılıyorum."
      : session?.consent === "DECLINED"
        ? "Kayıtlı kararınız: katılmıyorum. Ders açıktır."
        : session?.consent === "WITHDRAWN"
          ? "Kayıtlı kararınız: çekilme."
          : "Kayıtlı bir karar yok.";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Araştırma bilgilendirme ve onam</h1>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Bu metin yer tutucudur. Onaylı katılımcı bilgilendirme formu henüz girilmedi.
      </p>
      <p className="text-sm leading-6 text-stone-700">
        Burada araştırmanın amacı, toplanacak bilgiler, saklama süresi ve çekilme yolu
        yazılacaktır. Dosyayı kaldırmak arama dizinindeki noktaları siler. Araştırma
        kaydı olan gönderim satırları silinmez. Bu paragraf onaylı bir onam metni değildir.
      </p>
      <p className="text-sm text-stone-600">{consentLabel}</p>
      {message && (
        <p role="status" className="rounded-lg bg-stone-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => choose("ACCEPTED")}
          className="rounded-lg bg-stone-900 px-4 py-3 text-white disabled:opacity-50"
        >
          {pending === "ACCEPTED" ? "Kaydediliyor…" : "Katılıyorum"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => choose("DECLINED")}
          className="rounded-lg border border-stone-300 bg-white px-4 py-3 disabled:opacity-50"
        >
          {pending === "DECLINED" ? "Kaydediliyor…" : "Katılmıyorum, derse devam et"}
        </button>
      </div>
      {failed && (
        <button
          type="button"
          onClick={() => router.push("/ana")}
          className="text-sm font-medium text-stone-800 underline"
        >
          Derse devam et
        </button>
      )}
    </div>
  );
}

export default function OnamPage() {
  return (
    <OgrenciKabugu>
      <OnamFormu />
    </OgrenciKabugu>
  );
}
