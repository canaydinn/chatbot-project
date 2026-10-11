import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { studentPageGuard } from "./guard";

describe("sayfa koruması", () => {
  it("oturumu girişe, kodsuz kullanıcıyı mesaja ayırır", () => {
    assert.equal(studentPageGuard(null), "login");
    assert.equal(studentPageGuard({ researchCode: null }), "missing-code");
    assert.equal(studentPageGuard({ researchCode: "" }), "missing-code");
    assert.equal(studentPageGuard({ researchCode: "AB12" }), "ok");
  });
});
