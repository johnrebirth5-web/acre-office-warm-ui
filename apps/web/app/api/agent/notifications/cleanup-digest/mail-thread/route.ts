import { can, canAccessOfficeMail, canSendOfficeMail } from "@acre/auth";
import {
  buildFrontOfficeCleanupDigest,
  buildFrontOfficeCleanupDigestDeliveryDraft,
  createOfficeMailThread,
  prisma,
  recordFrontOfficeCleanupDigestInternalMailThreadOpenedActivity,
} from "@acre/db";
import { MembershipStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params?: Promise<Record<string, never>>;
};

type CleanupDigestMailThreadRouteDependencies = {
  getSessionContext: typeof getRequestSessionContext;
  canViewDashboard: typeof can;
  canAccessOfficeMail: typeof canAccessOfficeMail;
  canSendOfficeMail: typeof canSendOfficeMail;
  getCleanupDigest: typeof buildFrontOfficeCleanupDigest;
  buildDeliveryDraft: typeof buildFrontOfficeCleanupDigestDeliveryDraft;
  createOfficeMailThread: typeof createOfficeMailThread;
  recordThreadOpenedActivity: typeof recordFrontOfficeCleanupDigestInternalMailThreadOpenedActivity;
  resolveRecipientMembershipIds: typeof resolveCleanupDigestRecipientMembershipIds;
  buildResponse: typeof buildCleanupDigestInternalMailThreadResponse;
  mapErrorStatus: typeof mapCleanupDigestInternalMailThreadErrorStatus;
};

const cleanupDigestMailThreadFallbackHint =
  "If internal mail access is unavailable, keep working from the cleanup digest workbench instead.";

function buildCleanupDigestMailThreadSubject(draft: { subject: string }) {
  return draft.subject.trim() || "Cleanup digest";
}

function buildCleanupDigestMailThreadBody(input: {
  draft: {
    body: string;
    runSummary: {
      scopeLabel: string;
      generatedAtLabel: string;
      timeZone: string;
      windowLabel: string;
      totalCount: number;
      urgentCount?: number;
      dueSoonCount?: number;
      notificationCount: number;
      followUpTaskCount: number;
      clientReminderCount: number;
      appointmentCount: number;
      nextActionLabel: string;
      nextActionDetail: string;
    };
    summaryText: string;
    subject: string;
  };
}) {
  const summary = input.draft.runSummary;

  return [
    "Internal Acre continuity copy for the Front Office cleanup digest.",
    "Acre keeps this digest inside the workspace and does not imply provider sync or automated sending.",
    "",
    `Scope: ${summary.scopeLabel}`,
    `Generated: ${summary.generatedAtLabel}`,
    `Window: ${summary.windowLabel}`,
    `Time zone: ${summary.timeZone}`,
    `Summary: ${summary.totalCount} item(s), ${summary.urgentCount} urgent, ${summary.dueSoonCount} due soon`,
    `Next action: ${summary.nextActionLabel}`,
    `Next detail: ${summary.nextActionDetail}`,
    "",
    input.draft.body,
    "",
    "Review the internal mail thread, then return to the cleanup digest workbench and continue the manual pass.",
    "The external send remains manual and no provider sync is implied.",
  ].join("\n");
}

async function resolveCleanupDigestRecipientMembershipIds(input: {
  organizationId: string;
  membershipId: string;
  officeId: string | null;
}) {
  const query = {
    organizationId: input.organizationId,
    status: MembershipStatus.active,
    user: {
      isActive: true,
    },
    id: {
      not: input.membershipId,
    },
  } as const;

  const officeScopedRecipients = await prisma.membership.findMany({
    where: {
      ...query,
      ...(input.officeId
        ? {
            officeId: input.officeId,
          }
        : {}),
    },
    select: {
      id: true,
      role: true,
    },
  });

  const preferredRecipientIds = officeScopedRecipients
    .filter((membership) =>
      [
        "owner",
        "office_admin",
        "team_lead",
        "office_manager",
        "office_user",
        "accountant",
        "agent",
        "human_resources",
      ].includes(membership.role),
    )
    .map((membership) => membership.id);

  if (preferredRecipientIds.length > 0) {
    return preferredRecipientIds;
  }

  const fallbackRecipients = await prisma.membership.findMany({
    where: query,
    select: {
      id: true,
      role: true,
    },
  });

  const fallbackRecipientIds = fallbackRecipients
    .filter((membership) =>
      [
        "owner",
        "office_admin",
        "team_lead",
        "office_manager",
        "office_user",
        "accountant",
        "agent",
        "human_resources",
      ].includes(membership.role),
    )
    .map((membership) => membership.id);

  if (fallbackRecipientIds.length > 0) {
    return fallbackRecipientIds;
  }

  throw new Error(
    "No internal mail recipients are available for the cleanup digest thread.",
  );
}

function buildCleanupDigestInternalMailThreadResponse(input: {
  threadId: string;
  subject: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
}) {
  const actionTargetUrl = input.actionUrl?.trim() || null;
  const actionTargetLabel = input.actionLabel?.trim() || null;

  return {
    thread: {
      id: input.threadId,
      subject: input.subject,
    },
    threadHref: `/office/mail?threadId=${encodeURIComponent(input.threadId)}`,
    actionLabel: "Internal mail thread",
    actionTargetLabel,
    actionTargetUrl,
    manualOnlyDetail:
      "The Acre mail thread keeps the cleanup digest inside the workspace; the external send still stays manual and no provider sync is implied.",
    continuity: {
      label: "Cleanup digest thread opened",
      detail:
        "Acre created an internal mail thread for the cleanup digest so the continuity stays inside the workspace.",
      nextStep:
        "Review the Acre thread, then return to the cleanup digest workbench and keep the current cleanup queue visible.",
      sourceNote:
        "Internal mail continuity only; the outside send remains manual and no provider sync is implied.",
      returnToLabel: "Return to workbench",
      returnToDetail:
        "Jump back to the cleanup digest workbench after reviewing the thread, then continue the manual cleanup pass.",
      returnToUrl: actionTargetUrl,
    },
  };
}

function mapCleanupDigestInternalMailThreadErrorStatus(message: string) {
  if (
    message.includes("No internal mail recipients") ||
    message.includes("Only scheduled appointments")
  ) {
    return {
      status: 409 as const,
      hint: cleanupDigestMailThreadFallbackHint,
    };
  }

  if (
    message.includes("Mail access required") ||
    message.includes("Mail send access required")
  ) {
    return {
      status: 403 as const,
      hint: cleanupDigestMailThreadFallbackHint,
    };
  }

  return {
    status: 400 as const,
    hint: null,
  };
}

const cleanupDigestMailThreadRouteDependencies: CleanupDigestMailThreadRouteDependencies =
  {
    getSessionContext: getRequestSessionContext,
    canViewDashboard: can,
    canAccessOfficeMail,
    canSendOfficeMail,
    getCleanupDigest: buildFrontOfficeCleanupDigest,
    buildDeliveryDraft: buildFrontOfficeCleanupDigestDeliveryDraft,
    createOfficeMailThread,
    recordThreadOpenedActivity:
      recordFrontOfficeCleanupDigestInternalMailThreadOpenedActivity,
    resolveRecipientMembershipIds: resolveCleanupDigestRecipientMembershipIds,
    buildResponse: buildCleanupDigestInternalMailThreadResponse,
    mapErrorStatus: mapCleanupDigestInternalMailThreadErrorStatus,
  };

export async function handleCleanupDigestMailThreadPost(
  request: NextRequest,
  { params }: RouteContext,
  dependencies: CleanupDigestMailThreadRouteDependencies = cleanupDigestMailThreadRouteDependencies,
) {
  const context = await dependencies.getSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (
    !dependencies.canViewDashboard(context.currentMembership, "dashboard:view")
  ) {
    return NextResponse.json(
      { error: "Front Office dashboard access required." },
      { status: 403 },
    );
  }

  if (!dependencies.canAccessOfficeMail(context.currentMembership)) {
    return NextResponse.json(
      { error: "Mail access required." },
      { status: 403 },
    );
  }

  if (!dependencies.canSendOfficeMail(context.currentMembership)) {
    return NextResponse.json(
      { error: "Mail send access required." },
      { status: 403 },
    );
  }

  if (params) {
    await params;
  }

  try {
    const digest = await dependencies.getCleanupDigest({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
    });
    const draft = dependencies.buildDeliveryDraft(digest);
    const subject = buildCleanupDigestMailThreadSubject(draft);
    const body = buildCleanupDigestMailThreadBody({ draft });
    const recipientMembershipIds =
      await dependencies.resolveRecipientMembershipIds({
        organizationId: context.currentOrganization.id,
        membershipId: context.currentMembership.id,
        officeId: context.currentOffice?.id ?? null,
      });

    const thread = await dependencies.createOfficeMailThread({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      subject,
      body,
      recipientMembershipIds,
      actionUrl: "/agent/notifications",
      actionLabel: "Return to cleanup workbench",
    });

    await dependencies.recordThreadOpenedActivity(prisma, {
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      runSummary: draft.runSummary,
      threadId: thread.id,
      threadSubject: thread.subject,
      contextHref: "/agent/notifications",
    });

    return NextResponse.json(
      dependencies.buildResponse({
        threadId: thread.id,
        subject: thread.subject,
        actionUrl: "/agent/notifications",
        actionLabel: "Return to cleanup workbench",
      }),
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not open the cleanup digest mail thread.";
    const mappedError = dependencies.mapErrorStatus(message);

    return NextResponse.json(
      {
        error: message,
        ...(mappedError.hint ? { hint: mappedError.hint } : {}),
      },
      { status: mappedError.status },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleCleanupDigestMailThreadPost(request, context);
}
