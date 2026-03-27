import assert from "node:assert/strict";
import { test } from "node:test";
import { formatLocalDateTimeValue } from "./local-date-time";

test("formatLocalDateTimeValue follows the active runtime timezone", () => {
  const previousTimeZone = process.env.TZ;

  try {
    process.env.TZ = "UTC";
    assert.equal(formatLocalDateTimeValue("2026-03-27T16:59:00.000Z"), "Mar 27, 2026, 4:59 PM");

    process.env.TZ = "America/New_York";
    assert.equal(formatLocalDateTimeValue("2026-03-27T16:59:00.000Z"), "Mar 27, 2026, 12:59 PM");
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
});
