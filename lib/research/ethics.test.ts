import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyEthicsDraft, ethicsStoredFromDraft } from "./ethics";

describe("etik ayar kaydı", () => {
  it("boş formu kapalı kayıt olarak saklar", () => {
    const stored = ethicsStoredFromDraft(emptyEthicsDraft());
    assert.ok("row" in stored);
    if (!("row" in stored)) return;
    assert.equal(stored.row.enrollment_open, false);
    assert.equal(stored.row.board_name, null);
    assert.equal(stored.row.approval_date, null);
  });

  it("eksik alan varken kaydı açmaz", () => {
    const draft = emptyEthicsDraft();
    draft.board_name = "Kurul";
    draft.enrollment_open = true;
    const stored = ethicsStoredFromDraft(draft);
    assert.deepEqual(stored, { error: "Etik ayarları doldurulmadan araştırma kaydı açılamaz." });
  });

  it("tarihi yıl-ay-gün dışında kabul etmez", () => {
    const draft = emptyEthicsDraft();
    draft.approval_date = "12.10.2026";
    const stored = ethicsStoredFromDraft(draft);
    assert.deepEqual(stored, { error: "Onay tarihi yıl-ay-gün biçiminde yazılır." });
  });
});
