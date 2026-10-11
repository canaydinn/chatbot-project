"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OgrenciKabugu } from "../ogrenci/kabuk";
import { readHomeView, type HomeView } from "@/lib/student/view";

function AnaIcerik() {
  const [home, setHome] = useState<HomeView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/home")
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "Ana sayfa yüklenemedi.";
          throw new Error(message);
        }
        const view = readHomeView(body);
        if (!cancelled) setHome(view);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ana sayfa yüklenemedi.");
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
  if (!home) return <p className="text-stone-600">Hafta bilgisi yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h1 className="text-2xl font-semibold">
          {home.activeWeek ? home.activeWeek.title : "Aktif hafta yok"}
        </h1>
        {home.activeWeek ? (
          <p className="mt-1 text-sm text-stone-500">Hafta {home.activeWeek.weekNumber}</p>
        ) : (
          <p className="mt-2 text-sm text-stone-600">
            Eğitmen bir haftayı açtığında başlık ve görev burada görünür.
          </p>
        )}
        <h2 className="mt-4 text-sm font-medium">Görev</h2>
        <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">
          {home.activeWeek?.task ?? "Bu hafta için görev alanı yok."}
        </p>
        <h2 className="mt-4 text-sm font-medium">Kalan süre</h2>
        <p className="mt-1 text-sm text-stone-700">Süre sınırı tanımlı değil.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link href="/hafta" className="rounded-lg bg-stone-900 px-4 py-3 text-center text-white">
            Haftalık forma git
          </Link>
          <Link href="/karsilastirma" className="rounded-lg border border-stone-300 px-4 py-3 text-center">
            Sürümleri karşılaştır
          </Link>
        </div>
      </section>
      {home.enrollmentNote && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {home.enrollmentNote}
        </p>
      )}
      <section>
        <h2 className="text-lg font-semibold">Önceki hafta özetleri</h2>
        {home.previousWeeks.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">Önceki haftalara ait kayıtlı metin yok.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {home.previousWeeks.map((week) => (
              <li key={week.weekNumber} className="rounded-2xl border border-stone-200 bg-white p-4">
                <p className="font-medium">
                  Hafta {week.weekNumber}: {week.title}
                </p>
                <p className="mt-1 text-sm text-stone-600">{week.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AnaPage() {
  return (
    <OgrenciKabugu>
      <AnaIcerik />
    </OgrenciKabugu>
  );
}
