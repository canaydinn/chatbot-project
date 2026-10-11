import type { FeedbackCard } from "@/lib/student/view";

const ROWS: { key: keyof FeedbackCard; label: string }[] = [
  { key: "strengths", label: "Güçlü yönler" },
  { key: "missingEvidence", label: "Eksik kanıt" },
  { key: "unsupportedAssumption", label: "Desteksiz varsayım" },
  { key: "inconsistency", label: "Tutarsızlık" },
  { key: "suggestedRevision", label: "Önerilen revizyon" },
];

export function GeriBildirimKarti({ feedback }: { feedback: FeedbackCard }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Nitel geri bildirim</h2>
      <dl className="mt-4 space-y-3">
        {ROWS.map((row) => (
          <div key={row.key}>
            <dt className="text-sm font-medium text-stone-800">{row.label}</dt>
            <dd className="mt-1 text-sm text-stone-600">
              {feedback[row.key]?.trim() || "Henüz yok."}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
