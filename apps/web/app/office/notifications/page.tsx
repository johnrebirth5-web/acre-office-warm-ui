import Link from "next/link";
import { canAccessOfficeNotifications } from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { listOfficeNotifications } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeNotificationsClient } from "./notifications-client";

type OfficeNotificationsPageProps = {
  searchParams?: Promise<{
    view?: string;
    type?: string;
    category?: string;
    readState?: string;
  }>;
};

export default async function OfficeNotificationsPage(props: OfficeNotificationsPageProps) {
  const context = await requireOfficeSession();
  const { t } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });

  if (!canAccessOfficeNotifications(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await listOfficeNotifications({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    view: searchParams.view,
    type: searchParams.type,
    category: searchParams.category,
    readState: searchParams.readState
  });

  return (
    <OfficeListPageShell className="office-notifications-page">
      <OfficeListPageHeader
        actions={
          <Link className="office-button-secondary" href="/office/activity">
            {t((messages) => messages.officeNotifications.openActivityLog)}
          </Link>
        }
        description={t((messages) => messages.officeNotifications.description)}
        eyebrow={t((messages) => messages.officeNotifications.eyebrow)}
        summary={
          <>
            <SummaryChip label={t((messages) => messages.common.officeScope)} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={t((messages) => messages.officeNotifications.unread)} tone="accent" value={snapshot.summary.unreadCount} />
            <SummaryChip label={t((messages) => messages.officeNotifications.inbox)} value={snapshot.summary.activeCount} />
            <SummaryChip label={t((messages) => messages.officeNotifications.archived)} value={snapshot.summary.archivedCount} />
            <SummaryChip label={t((messages) => messages.officeNotifications.reviewQueue)} value={snapshot.summary.reviewCount} />
            <SummaryChip label={t((messages) => messages.officeNotifications.payoutReview)} tone="accent" value={snapshot.summary.payoutReviewCount} />
          </>
        }
        title={t((messages) => messages.officeNotifications.title)}
      />

      <OfficeNotificationsClient snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
