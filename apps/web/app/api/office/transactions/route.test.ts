import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlainObject,
  parseAllowedString,
  parsePositiveInteger,
  readJsonObject,
} from "../../../../lib/validate";

test("parsePositiveInteger accepts blank input, clamps max, and rejects non-numeric values", () => {
  assert.equal(parsePositiveInteger(null, 1), 1);
  assert.equal(parsePositiveInteger("  ", 3), 3);
  assert.equal(parsePositiveInteger("12", 1), 12);
  assert.equal(parsePositiveInteger("12", 1, 10), 10);
  assert.equal(parsePositiveInteger("abc", 1), null);
  assert.equal(parsePositiveInteger("-1", 1), null);
});

test("parseAllowedString only accepts allowed values and falls back on blanks", () => {
  const allowed = ["All", "Pending", "Closed"] as const;

  assert.equal(parseAllowedString(null, allowed, "All"), "All");
  assert.equal(parseAllowedString("  ", allowed, "All"), "All");
  assert.equal(parseAllowedString("Pending", allowed, "All"), "Pending");
  assert.equal(parseAllowedString("Rejected", allowed, "All"), null);
});

test("readJsonObject only accepts plain objects", async () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);

  const objectBody = await readJsonObject({
    async json() {
      return { transactionType: "listing" };
    },
  });

  const arrayBody = await readJsonObject({
    async json() {
      return ["bad"];
    },
  });

  const rejectedBody = await readJsonObject({
    async json() {
      throw new Error("invalid json");
    },
  });

  assert.deepEqual(objectBody, { transactionType: "listing" });
  assert.equal(arrayBody, null);
  assert.equal(rejectedBody, null);
});
