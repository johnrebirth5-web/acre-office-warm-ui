import { getDefaultAppPath, hasAnyPermission } from "@acre/auth";
import { openOfficeNotification } from "@acre/db";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../../../lib/auth-session";

type AgentNotificationOpenPageProps = {
  params: Promise<{
    notificationId: string;
  }>;
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

function appendNoticeFeedback(href: string, notificationId: string) {
  const [baseHref, hash = ""] = href.split("#", 2);
  const [pathname, query = ""] = baseHref.split("?", 2);
  const params = new URLSearchParams(query);

  params.set("noticeFeedback", "opened_from_center");
  params.set("openedNoticeId", notificationId);

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
  const fallbackUrl = appendNoticeFeedback(
    resolvedSearchParams.returnTo || "/agent/notifications",
    notificationId,
  );
  const actionUrl = await openOfficeNotification({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    notificationId,
    fallbackUrl,
  });

  redirect(actionUrl || fallbackUrl);
}
