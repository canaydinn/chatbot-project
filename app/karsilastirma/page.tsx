"use client";

import { useEffect, useState } from "react";
import { OgrenciKabugu } from "../ogrenci/kabuk";
import { pairedRevision } from "@/lib/research/stages";
import { readWeekView, type WeekView } from "@/lib/student/view";

function KarsilastirmaIcerik() {
  const [week, setWeek] = useState<WeekView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/week")
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "Sürümler yüklenemedi.";
          throw new Error(message);
        }
        const view = readWeekView(body);
        if (!cancelled) setWeek(view);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Sürümler yüklenemedi.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
        {error}
      </p>
    );
  }
  if (!week) return <p className="text-stone-600">Sürümler yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sürüm karşılaştırma</h1>
      <p className="text-sm text-stone-600">
        {week.title ? `${week.title}. ` : ""}
        Kendi ilk metniniz ve revizyonunuz yan yana durur.
      </p>
      {week.isV0V1 && pairedRevision(week.versions.v0, week.versions.v1) == null && (
        <p className="text-sm text-stone-700">Eksik sürüm olduğu için fark hesaplanmaz.</p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="font-medium">V0</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
            {week.versions.v0 ?? "Bu sürüm henüz yok."}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="font-medium">V1</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
            {week.versions.v1 ?? "Bu sürüm henüz yok."}
          </p>
        </article>
      </div>
    </div>
  );
}

export default function KarsilastirmaPage() {
  return (
    <OgrenciKabugu>
      <KarsilastirmaIcerik />
    </OgrenciKabugu>
  );
}
