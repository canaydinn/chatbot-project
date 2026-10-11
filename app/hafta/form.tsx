"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { OgrenciKabugu, useOturum } from "../ogrenci/kabuk";
import { DosyaYukleme } from "../ogrenci/dosya";
import { GeriBildirimKarti } from "../ogrenci/geri-bildirim";
import { readWeekView, type WeekView } from "@/lib/student/view";

function HaftaIcerik() {
  const { session } = useOturum();
  const [week, setWeek] = useState<WeekView | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [Panel, setPanel] = useState<ComponentType | null>(null);
  const dirty = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/week")
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "Hafta yüklenemedi.";
          throw new Error(message);
        }
        const view = readWeekView(body);
        if (!cancelled) setWeek(view);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Hafta yüklenemedi.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!week?.coachPanel) {
      setPanel(null);
      return;
    }
    let cancelled = false;
    import("../ogrenci/sohbet").then((mod) => {
      if (!cancelled) setPanel(() => mod.SohbetPaneli);
    });
    return () => {
      cancelled = true;
    };
  }, [week?.coachPanel]);

  const storageKey =
    session && week?.activeWeek != null
      ? `is-plani-taslak:${session.userId}:${week.activeWeek}`
      : null;

  useEffect(() => {
    if (!week || loaded.current) return;
    loaded.current = true;
    let local: Record<string, unknown> | null = null;
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        local = stored ? (JSON.parse(stored) as Record<string, unknown>) : null;
      } catch {
        local = null;
      }
    }
    const next: Record<string, string> = {};
    for (const field of week.fields) {
      const raw = local?.[field.id];
      const fromLocal = typeof raw === "string" ? raw : "";
      const fromDraft = week.draft?.[field.id] ?? "";
      next[field.id] = fromLocal || fromDraft;
    }
    setValues(next);
  }, [week, storageKey]);

  useEffect(() => {
    if (!loaded.current || !dirty.current || !storageKey) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(values));
      setSaveNote("Taslak bu cihaza yazılıyor…");
      fetch("/api/student/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", fields: values }),
      })
        .then(async (response) => {
          const body: unknown = await response.json().catch(() => null);
          const record =
            body && typeof body === "object"
              ? (body as { message?: unknown; error?: unknown })
              : {};
          if (!response.ok) {
            setSaveNote(
              typeof record.error === "string"
                ? record.error
                : "Taslak sunucuya yazılamadı. Metin bu cihazda duruyor.",
            );
            return;
          }
          setSaveNote(
            typeof record.message === "string" ? record.message : "Taslak kaydedildi.",
          );
        })
        .catch(() => setSaveNote("Sunucuya bağlanılamadı. Taslak bu cihazda duruyor."));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [values, storageKey]);

  async function submit() {
    setSubmitting(true);
    setSaveNote("");
    try {
      const response = await fetch("/api/student/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", fields: values }),
      });
      const body: unknown = await response.json().catch(() => null);
      const record =
        body && typeof body === "object" ? (body as { message?: unknown; error?: unknown }) : {};
      const text =
        typeof record.message === "string"
          ? record.message
          : typeof record.error === "string"
            ? record.error
            : response.ok
              ? "Gönderildi."
              : "Gönderilemedi.";
      setSaveNote(text);
    } catch {
      setSaveNote("Sunucuya bağlanılamadı. Metin bu cihazda duruyor.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
        {error}
      </p>
    );
  }
  if (!week) return <p className="text-stone-600">Form yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h1 className="text-2xl font-semibold">{week.title ?? "Haftalık form"}</h1>
        {week.activeWeek == null ? (
          <p className="mt-2 text-sm text-stone-600">
            Aktif hafta yok. Form alanları bir hafta açılınca burada belirir.
          </p>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{week.task}</p>
        )}
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {week.fields.map((field) => (
            <label key={field.id} className="block text-sm">
              <span className="font-medium">{field.label}</span>
              <textarea
                value={values[field.id] ?? ""}
                onChange={(event) => {
                  dirty.current = true;
                  setValues((current) => ({ ...current, [field.id]: event.target.value }));
                }}
                rows={4}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3 text-base"
              />
            </label>
          ))}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={submitting || week.activeWeek == null}
              className="rounded-lg bg-stone-900 px-4 py-3 text-white disabled:opacity-50"
            >
              {submitting ? "Gönderiliyor…" : "Gönder"}
            </button>
            {saveNote && (
              <p role="status" className="text-sm text-stone-600">
                {saveNote}
              </p>
            )}
          </div>
        </form>
      </section>
      <GeriBildirimKarti feedback={week.feedback} />
      <DosyaYukleme />
      {week.coachPanel && Panel ? <Panel /> : null}
    </div>
  );
}

export function HaftaFormu() {
  return (
    <OgrenciKabugu>
      <HaftaIcerik />
    </OgrenciKabugu>
  );
}
