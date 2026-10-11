import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { highIndexLeftovers, removeSearchPoints, replaceSearchPoints } from "./index";

describe("arama dizini", () => {
  it("kaldırma noktaları siler ve gönderimleri tutar", async () => {
    const deleted: string[] = [];
    const result = await removeSearchPoints(
      {
        async deleteCollection(name) {
          deleted.push(name);
        },
      },
      "AB12",
    );
    assert.deepEqual(deleted, ["plan_AB12"]);
    assert.equal(result.submissions, "keep");
  });

  it("dizin yokken de gönderim satırına dokunmaz", async () => {
    const result = await removeSearchPoints(
      {
        async deleteCollection() {
          const error = new Error("Not found: collection");
          throw error;
        },
      },
      "AB12",
    );
    assert.equal(result.submissions, "keep");
    assert.equal(result.collection, "plan_AB12");
  });

  it("yeni yükleme eski yüksek indeksleri bırakmaz", async () => {
    assert.deepEqual(highIndexLeftovers([0, 1, 2, 3, 4], 2), [2, 3, 4]);
    const calls: string[] = [];
    const result = await replaceSearchPoints(
      {
        async deleteCollection(name) {
          calls.push(`delete:${name}`);
        },
        async createCollection(name) {
          calls.push(`create:${name}`);
        },
      },
      "AB12",
    );
    assert.deepEqual(calls, ["delete:plan_AB12", "create:plan_AB12"]);
    assert.equal(result.submissions, "keep");
    assert.deepEqual(highIndexLeftovers([], 2), []);
  });
});
