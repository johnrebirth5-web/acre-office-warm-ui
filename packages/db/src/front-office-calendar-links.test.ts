import assert from "node:assert/strict";
import test from "node:test";
import { buildFrontOfficeAppointmentCalendarExport } from "./front-office-calendar-links";

test("calendar exports carry the bridge follow-up cadence into the draft", () => {
  const exportPayload = buildFrontOfficeAppointmentCalendarExport({
    appointmentId: "appointment-1",
    title: "Showing with Jamie Chen",
    startsAt: new Date("2026-04-08T18:00:00.000Z"),
    location: "123 Main St, Brooklyn",
    clientName: "Jamie Chen",
    externalStatusLabel: "Awaiting confirmation",
    externalNextActionAtLabel: "2026-04-08 2:00 PM",
    followUpCadenceLabel: "Awaiting reply · +2h",
    followUpCadenceDetail:
      "Best when you expect a same-day confirmation reply. Save it back on the appointment once the bridge action is done.",
    timeZone: "America/New_York",
  });

  assert.match(
    exportPayload.content,
    /Bridge follow-up cadence: Awaiting reply · \+2h/,
  );
  assert.match(exportPayload.content, /Cadence detail: Best when you expect/);
  assert.match(exportPayload.fileName, /^showing-with-jamie-chen-/);
});
