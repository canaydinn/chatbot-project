"use client";

import { useEffect, useState } from "react";
import { OgrenciKabugu } from "../ogrenci/kabuk";
import { ETHICS_FIELDS, emptyEthicsDraft, type EthicsDraft } from "@/lib/research/ethics";

function EtikFormu() {
  const [draft, setDraft] = useState<EthicsDraft>(emptyEthicsDraft);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/instructor/ethics")
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "Etik ayarları yüklenemedi.";
          throw new Error(message);
        }
        const settings =
          body && typeof body === "object" && "settings" in body ? body.settings : null;
        if (!cancelled && settings && typeof settings === "object") {
          const next = emptyEthicsDraft();
          for (const field of ETHICS_FIELDS) {
            const value = (settings as Record<string, unknown>)[field.key];
            next[field.key] = typeof value === "string" ? value : "";
          }
          next.enrollment_open = (settings as { enrollment_open?: unknown }).enrollment_open === true;
          setDraft(next);
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Etik ayarları yüklenemedi.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setNote("");
    const response = await fetch("/api/instructor/ethics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : response.ok
          ? draft.enrollment_open
            ? "Kaydedildi. Araştırma kaydı açık."
            : "Kaydedildi. Araştırma kaydı kapalı."
          : "Kaydedilemedi.";
    setNote(message);
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
        {error}
      </p>
    );
  }
  if (!ready) return <p className="text-stone-600">Etik ayarları yükleniyor…</p>;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h1 className="text-2xl font-semibold">Etik kurul ayarları</h1>
      <p className="text-sm text-stone-600">
        Alanlar boşken araştırma kaydı kapalı kalır. Kayıt, hepsi doluyken açılır.
      </p>
      {ETHICS_FIELDS.map((field) => (
        <label key={field.key} className="block text-sm">
          {field.label}
          {field.kind === "long" ? (
            <textarea
              value={draft[field.key]}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.key]: event.target.value }))
              }
              rows={3}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3 text-base"
            />
          ) : (
            <input
              type={field.kind === "date" ? "date" : "text"}
              value={draft[field.key]}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.key]: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3 text-base"
            />
          )}
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.enrollment_open}
          onChange={(event) =>
            setDraft((current) => ({ ...current, enrollment_open: event.target.checked }))
          }
        />
        Araştırmaya kaydı aç
      </label>
      <button type="submit" className="rounded-lg bg-stone-900 px-4 py-3 text-white">
        Kaydet
      </button>
      {note ? <p className="text-sm text-stone-600">{note}</p> : null}
    </form>
  );
}

export default function EtikPage() {
  return (
    <OgrenciKabugu>
      <EtikFormu />
    </OgrenciKabugu>
  );
}
