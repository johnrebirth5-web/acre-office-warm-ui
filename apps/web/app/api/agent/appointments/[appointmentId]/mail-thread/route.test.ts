import assert from "node:assert/strict";
import test from "node:test";
import { type NextRequest } from "next/server";
import {
  buildAppointmentInternalMailThreadResponse,
  type AppointmentInternalMailThreadOpenedActivityInput,
} from "@acre/db";
import { handleAppointmentMailThreadPost } from "./route";

type RouteDependencies = NonNullable<
  Parameters<typeof handleAppointmentMailThreadPost>[2]
>;

function createRequest() {
  return new Request("https://example.com/api/agent/appointments/apt_123/mail-thread") as NextRequest;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function buildDependencies(overrides: Partial<RouteDependencies>): RouteDependencies {
  return {
    getSessionContext: async () =>
      ({
        currentMembership: { id: "member_1" },
        currentOrganization: { id: "org_1" },
        currentOffice: { id: "office_1" },
        currentUser: { timezone: "America/New_York" },
      }) as never,
    canViewDashboard: () => true,
    canAccessOfficeMail: () => true,
    canSendOfficeMail: () => true,
    getAppointmentsSnapshot: async () =>
      ({
        selectedAppointment: {
          id: "apt_123",
          title: "Buyer Check-In",
          startsAtLabel: "April 9, 2026 at 10:00 AM",
          endsAtLabel: "April 9, 2026 at 10:30 AM",
          clientLabel: "Ava Client",
          clientEmailLabel: "ava@example.com",
          contactLabel: "Ava Client <ava@example.com>",
          listingLabel: "12 Main St",
          locationLabel: "Living room",
          coordinationLabel: "Prepare internal continuity brief",
          coordinationNextStep: "Review and save the next checkpoint",
          externalStatusLabel: "Confirmed",
          externalNote: "Bring listing docs",
          emailBriefHref: "mailto:ava@example.com",
          statusValue: "scheduled",
        },
      }) as never,
    resolveRecipientMembershipIds: async () => ["recipient_1"],
    createOfficeMailThread: async () =>
      ({
        id: "thread_123",
        subject: "Confirmed: Buyer Check-In on April 9, 2026 at 10:00 AM",
      }) as never,
    recordAppointmentInternalMailThreadOpenedActivity: async (
      _input: AppointmentInternalMailThreadOpenedActivityInput,
    ) => {},
    buildAppointmentInternalMailThreadResponse,
    mapErrorStatus: (message: string) => ({
      status: message.includes("No internal mail recipients") ? 409 : 400,
      hint: message.includes("No internal mail recipients")
        ? "If internal mail access is unavailable, use the external email brief from the appointment bridge instead."
        : null,
    }),
    ...overrides,
  };
}

test("returns 401 when appointment mail thread access is unauthenticated", async () => {
  const response = await handleAppointmentMailThreadPost(
    createRequest(),
    { params: Promise.resolve({ appointmentId: "apt_123" }) },
    buildDependencies({
      getSessionContext: async () => null,
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "Authentication required.",
  });
});

test("returns 403 when dashboard access is missing", async () => {
  const response = await handleAppointmentMailThreadPost(
    createRequest(),
    { params: Promise.resolve({ appointmentId: "apt_123" }) },
    buildDependencies({
      canViewDashboard: () => false,
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Front Office dashboard access required.",
  });
});

test("returns 404 when the appointment cannot be resolved", async () => {
  const response = await handleAppointmentMailThreadPost(
    createRequest(),
    { params: Promise.resolve({ appointmentId: "apt_missing" }) },
    buildDependencies({
      getAppointmentsSnapshot: async () =>
        ({
          selectedAppointment: null,
        }) as never,
    }),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await readJson(response), {
    error: "Appointment not found.",
  });
});

test("returns 409 when the appointment has no email target for the internal mail thread", async () => {
  const response = await handleAppointmentMailThreadPost(
    createRequest(),
    { params: Promise.resolve({ appointmentId: "apt_123" }) },
    buildDependencies({
      getAppointmentsSnapshot: async () =>
        ({
          selectedAppointment: {
            id: "apt_123",
            title: "Buyer Check-In",
            startsAtLabel: "April 9, 2026 at 10:00 AM",
            endsAtLabel: "April 9, 2026 at 10:30 AM",
            clientLabel: "Ava Client",
            clientEmailLabel: "",
            contactLabel: "Ava Client <ava@example.com>",
            listingLabel: "12 Main St",
            locationLabel: "Living room",
            coordinationLabel: "Prepare internal continuity brief",
            coordinationNextStep: "Review and save the next checkpoint",
            externalStatusLabel: "Confirmed",
            externalNote: "Bring listing docs",
            emailBriefHref: null,
            statusValue: "scheduled",
          },
        }) as never,
    }),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await readJson(response), {
    error: "An email target is required before opening the appointment mail thread.",
    hint:
      "If internal mail access is unavailable, use the external email brief from the appointment bridge instead.",
  });
});

test("returns 201 and a no-store internal mail thread response when the appointment is scheduled", async () => {
  let recordedInput: AppointmentInternalMailThreadOpenedActivityInput | null =
    null;
  const response = await handleAppointmentMailThreadPost(
    createRequest(),
    { params: Promise.resolve({ appointmentId: "apt_123" }) },
    buildDependencies({
      recordAppointmentInternalMailThreadOpenedActivity: async (input) => {
        recordedInput = input;
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(recordedInput);
  assert.deepEqual(recordedInput, {
    organizationId: "org_1",
    membershipId: "member_1",
    officeId: "office_1",
    appointment: {
      id: "apt_123",
      title: "Buyer Check-In",
      startsAtLabel: "April 9, 2026 at 10:00 AM",
      endsAtLabel: "April 9, 2026 at 10:30 AM",
      clientLabel: "Ava Client",
      clientEmailLabel: "ava@example.com",
      contactLabel: "Ava Client <ava@example.com>",
      listingLabel: "12 Main St",
      locationLabel: "Living room",
      coordinationLabel: "Prepare internal continuity brief",
      coordinationNextStep: "Review and save the next checkpoint",
      externalStatusLabel: "Confirmed",
      externalNote: "Bring listing docs",
    },
    thread: {
      id: "thread_123",
      subject: "Confirmed: Buyer Check-In on April 9, 2026 at 10:00 AM",
    },
    contextHref: "/agent/calendar?appointmentId=apt_123",
  });
  assert.deepEqual(await readJson(response), {
    thread: {
      id: "thread_123",
      subject: "Confirmed: Buyer Check-In on April 9, 2026 at 10:00 AM",
    },
    threadHref: "/office/mail?threadId=thread_123",
    actionLabel: "Internal mail thread",
    actionTargetLabel: "Open appointment",
    actionTargetUrl: "/agent/calendar?appointmentId=apt_123",
    manualOnlyDetail:
      "The Acre mail thread keeps the appointment email brief inside the workspace; the external send still stays manual and no provider sync is implied.",
    continuity: {
      label: "Internal mail thread opened",
      detail:
        "Acre created an internal mail thread for the appointment brief so the continuity stays inside the workspace.",
      nextStep:
        "Review the Acre thread, then return to the appointment record and save the next checkpoint.",
      sourceNote:
        "Internal mail continuity only; the outside email remains manual and no provider sync is implied.",
      returnToLabel: "Return to writeback",
      returnToDetail:
        "Jump back to the same appointment after reviewing the thread, then save the next checkpoint in Acre.",
      returnToUrl: "/agent/calendar?appointmentId=apt_123",
    },
  });
});
