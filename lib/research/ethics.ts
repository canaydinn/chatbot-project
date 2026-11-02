export const ETHICS_FIELDS = [
  { key: "board_name", label: "Kurul adı", kind: "text" },
  { key: "approval_date", label: "Onay tarihi", kind: "date" },
  { key: "approval_number", label: "Onay numarası", kind: "text" },
  { key: "protocol_version", label: "Protokol sürümü", kind: "text" },
  { key: "consent_document_version", label: "Onam belgesi sürümü", kind: "text" },
  { key: "retention_period", label: "Saklama süresi", kind: "text" },
  { key: "data_controller", label: "Veri sorumlusu", kind: "text" },
  { key: "research_contact", label: "Araştırma iletişim adresi", kind: "text" },
  { key: "research_starts_on", label: "Araştırma başlangıcı", kind: "date" },
  { key: "research_ends_on", label: "Araştırma bitişi", kind: "date" },
  { key: "authorized_processors", label: "Yetkili işleyenler", kind: "long" },
  { key: "ai_providers", label: "Yapay zeka sağlayıcıları", kind: "long" },
] as const;

export type EthicsKey = (typeof ETHICS_FIELDS)[number]["key"];

export type EthicsDraft = Record<EthicsKey, string> & {
  enrollment_open: boolean;
};

export type EthicsStored = Record<EthicsKey, string | null> & {
  enrollment_open: boolean;
};

const DATE_KEYS = new Set<EthicsKey>(["approval_date", "research_starts_on", "research_ends_on"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function emptyEthicsDraft(): EthicsDraft {
  const draft = { enrollment_open: false } as EthicsDraft;
  for (const field of ETHICS_FIELDS) draft[field.key] = "";
  return draft;
}

export function ethicsDraftFromRow(row: Partial<Record<EthicsKey, unknown>> & { enrollment_open?: unknown }): EthicsDraft {
  const draft = emptyEthicsDraft();
  for (const field of ETHICS_FIELDS) {
    const value = row[field.key];
    draft[field.key] = typeof value === "string" ? value : "";
  }
  draft.enrollment_open = row.enrollment_open === true;
  return draft;
}

export function ethicsStoredFromDraft(draft: EthicsDraft): { row: EthicsStored } | { error: string } {
  const row = { enrollment_open: draft.enrollment_open } as EthicsStored;
  for (const field of ETHICS_FIELDS) {
    const trimmed = draft[field.key].trim();
    if (trimmed === "") {
      row[field.key] = null;
      continue;
    }
    if (DATE_KEYS.has(field.key) && !DATE_PATTERN.test(trimmed)) {
      return { error: `${field.label} yıl-ay-gün biçiminde yazılır.` };
    }
    row[field.key] = trimmed;
  }
  if (row.enrollment_open && ETHICS_FIELDS.some((field) => row[field.key] == null)) {
    return { error: "Etik ayarları doldurulmadan araştırma kaydı açılamaz." };
  }
  return { row };
}
