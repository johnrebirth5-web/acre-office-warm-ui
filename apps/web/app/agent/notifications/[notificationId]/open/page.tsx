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
  const actionUrl = await openOfficeNotification({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    notificationId,
    fallbackUrl: resolvedSearchParams.returnTo || "/agent/notifications",
  });

  redirect(actionUrl || "/agent/notifications");
}
