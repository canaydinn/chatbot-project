import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapSheetRow } from "./import-legacy-sheets";

describe("Sheets satır eşlemesi", () => {
  it("ad, soyad, e-posta ve eski puan hücrelerini ham satırda tutar", () => {
    const mapped = mapSheetRow(["Ada", "Lovelace", "Ada@Example.com", "2026-01-01", "80", "", "", "", "", ""]);
    assert.equal(mapped.firstName, "Ada");
    assert.equal(mapped.lastName, "Lovelace");
    assert.equal(mapped.email, "ada@example.com");
    assert.equal(mapped.rawRow.puan_a, "80");
    assert.equal(mapped.rawRow.puan_f, "");
  });
});
