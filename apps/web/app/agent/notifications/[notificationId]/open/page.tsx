import { getDefaultAppPath, hasAnyPermission } from "@acre/auth";
import { openOfficeNotification } from "@acre/db";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../../../lib/auth-session";
import {
  resolveNoticeFeedback,
  sanitizeNotificationReturnTo,
} from "../../agent-notifications-config";

type AgentNotificationOpenPageProps = {
  params: Promise<{
    notificationId: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
    returnTo?: string;
  }>;
};

function appendNoticeFeedback(input: {
  href: string;
  feedback: string | null;
  notificationId: string;
}) {
  const sanitizedHref =
    sanitizeNotificationReturnTo(input.href) || "/agent/notifications";
  const [baseHref, hash = ""] = sanitizedHref.split("#", 2);
  const [pathname, query = ""] = baseHref.split("?", 2);
  const params = new URLSearchParams(query);

  if (input.feedback) {
    params.set("noticeFeedback", input.feedback);
  } else {
    params.delete("noticeFeedback");
  }
  params.set("openedNoticeId", input.notificationId);

  const nextQuery = params.toString();

  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}

export default async function AgentNotificationOpenPage({
  params,
  searchParams,
}: AgentNotificationOpenPageProps) {
  const context = await requireSessionContext();

  if (
    !hasAnyPermission(context.currentMembership, [
      "notifications:view",
      "events:view",
      "clients:view",
      "dashboard:view",
    ])
  ) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const { notificationId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const fallbackUrl = appendNoticeFeedback({
    href:
      sanitizeNotificationReturnTo(resolvedSearchParams.returnTo) ||
      "/agent/notifications",
    feedback: resolveNoticeFeedback(resolvedSearchParams.feedback),
    notificationId,
  });
  const actionUrl = await openOfficeNotification({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    notificationId,
    fallbackUrl,
  });

  redirect(actionUrl || fallbackUrl);
}
