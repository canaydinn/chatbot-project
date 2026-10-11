import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { publicChatErrorBody } from "./chat-error";

describe("sohbet hata gövdesi", () => {
  it("ileti ve yığın izini dışarı vermez", () => {
    const leaked = new Error("gizli bağlanamadı: plan_AB12");
    leaked.stack = "Error: gizli bağlanamadı: plan_AB12\n    at hidden (/app/api/chat/route.ts:1:1)";
    const body = publicChatErrorBody();
    const json = JSON.stringify(body);
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.equal(json.includes(leaked.message), false);
    assert.equal(json.includes("at hidden"), false);
    assert.equal(json.includes("stack"), false);
  });
});
