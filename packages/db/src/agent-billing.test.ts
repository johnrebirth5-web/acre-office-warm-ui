import assert from "node:assert/strict";
import test from "node:test";
import { getNextRecurringDate } from "./agent-billing.ts";

function formatDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

test("monthly recurring dates clamp to the last day of short months", () => {
  const nextDate = getNextRecurringDate(
    {
      frequency: "monthly",
      customIntervalDays: null
    },
    new Date("2025-01-31T12:00:00.000Z")
  );

  assert.equal(formatDateValue(nextDate), "2025-02-28");
});

test("annual recurring dates clamp leap day to the target month end", () => {
  const nextDate = getNextRecurringDate(
    {
      frequency: "annual",
      customIntervalDays: null
    },
    new Date("2024-02-29T12:00:00.000Z")
  );

  assert.equal(formatDateValue(nextDate), "2025-02-28");
});
