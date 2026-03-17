import { canAccessOfficeNotifications } from "@acre/auth";
import { openOfficeNotification } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";

type OfficeNotificationOpenPageProps = {
  params: Promise<{
    notificationId: string;
  }>;
};

export default async function OfficeNotificationOpenPage({ params }: OfficeNotificationOpenPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOfficeNotifications(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const { notificationId } = await params;
  const actionUrl = await openOfficeNotification({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    notificationId
  });

  redirect(actionUrl || "/office/notifications");
}
