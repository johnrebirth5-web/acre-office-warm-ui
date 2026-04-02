import Link from "next/link";
import { canAccessOfficeNotifications } from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { listOfficeNotifications } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeNotificationsClient } from "./notifications-client";

type OfficeNotificationsPageProps = {
  searchParams?: Promise<{
    type?: string;
    category?: string;
    readState?: string;
  }>;
};

export default async function OfficeNotificationsPage(props: OfficeNotificationsPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOfficeNotifications(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await listOfficeNotifications({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    type: searchParams.type,
    category: searchParams.category,
    readState: searchParams.readState
  });

  return (
    <OfficeListPageShell className="office-notifications-page">
      <OfficeListPageHeader
        actions={
          <Link className="office-button-secondary" href="/office/activity">
            Open activity log
          </Link>
        }
        description="Personal inbox for payout review, review work, follow-ups, offer changes, signatures, and incoming updates. Activity log remains the audited system-wide record."
        eyebrow="Notifications"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Unread" tone="accent" value={snapshot.summary.unreadCount} />
            <SummaryChip label="Review queue" value={snapshot.summary.reviewCount} />
            <SummaryChip label="Payout review" tone="accent" value={snapshot.summary.payoutReviewCount} />
          </>
        }
        title="Notifications"
      />

      <OfficeNotificationsClient snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
