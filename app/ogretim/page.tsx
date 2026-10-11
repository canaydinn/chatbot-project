"use client";

import { useEffect, useState } from "react";
import { OgrenciKabugu } from "../ogrenci/kabuk";

type WeekMinutes = {
  week_number: number;
  title: string;
  v0_minutes: number | null;
  v1_minutes: number | null;
};

function SureFormu() {
  const [weeks, setWeeks] = useState<WeekMinutes[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/instructor/weeks")
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "Süreler yüklenemedi.";
          throw new Error(message);
        }
        const rows =
          body && typeof body === "object" && "weeks" in body && Array.isArray(body.weeks)
            ? (body.weeks as WeekMinutes[])
            : [];
        if (!cancelled) {
          setWeeks(rows);
          const next: Record<number, string> = {};
          for (const row of rows) next[row.week_number] = row.v0_minutes == null ? "" : String(row.v0_minutes);
          setDrafts(next);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Süreler yüklenemedi.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(weekNumber: number) {
    setNote("");
    const raw = drafts[weekNumber]?.trim() ?? "";
    const minutes = raw === "" ? null : Number(raw);
    const response = await fetch("/api/instructor/weeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekNumber,
        v0Minutes: minutes,
        v1Minutes: minutes,
      }),
    });
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : response.ok
          ? "Kaydedildi."
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
  if (weeks.length === 0) return <p className="text-stone-600">Süreler yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">V0 ve V1 süreleri</h1>
      <p className="text-sm text-stone-600">
        Boş bırakılırsa o haftanın aşaması açılmaz. V1, V0 ile aynı süreyi kullanır.
      </p>
      {weeks.map((week) => (
        <form
          key={week.week_number}
          className="rounded-2xl border border-stone-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save(week.week_number);
          }}
        >
          <h2 className="font-medium">
            Hafta {week.week_number}: {week.title}
          </h2>
          <label className="mt-3 block text-sm">
            Dakika
            <input
              inputMode="numeric"
              value={drafts[week.week_number] ?? ""}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [week.week_number]: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3 text-base"
            />
          </label>
          <button type="submit" className="mt-3 rounded-lg bg-stone-900 px-4 py-3 text-white">
            Kaydet
          </button>
        </form>
      ))}
      {note && <p className="text-sm text-stone-600">{note}</p>}
    </div>
  );
}

export default function OgretimPage() {
  return (
    <OgrenciKabugu>
      <SureFormu />
    </OgrenciKabugu>
  );
}
