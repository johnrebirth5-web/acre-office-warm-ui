import Link from "next/link";
import { getRoleSummary } from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { getOfficeAccountSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import {
  OfficeListPageHeader,
  OfficeListPageShell,
} from "../_components/office-list-page-template";
import { OfficeAccountClient } from "./account-client";

export default async function OfficeAccountPage() {
  const context = await requireOfficeSession();
  const { t } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const snapshot = await getOfficeAccountSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
  });

  if (!snapshot) {
    redirect("/office/dashboard");
  }

  return (
    <OfficeListPageShell className="office-account-page">
      <OfficeListPageHeader
        actions={
          <Link
            className="office-button-secondary office-button-sm"
            href="/office/notifications"
          >
            {t((messages) => messages.common.openNotifications)}
          </Link>
        }
        description={t((messages) => messages.officeAccount.description)}
        eyebrow={t((messages) => messages.officeAccount.eyebrow)}
        summary={
          <>
            <SummaryChip
              label={t((messages) => messages.common.officeScope)}
              value={
                context.currentOffice?.name ?? context.currentOrganization.name
              }
            />
            <SummaryChip
              label={t((messages) => messages.common.role)}
              value={getRoleSummary(context.currentMembership).label}
            />
            <SummaryChip
              label={t((messages) => messages.officeAccount.openTasks)}
              tone="accent"
              value={snapshot.summary.openTaskCount}
            />
          </>
        }
        title={t((messages) => messages.officeAccount.title)}
      />

      <OfficeAccountClient
        currentMembershipId={context.currentMembership.id}
        snapshot={snapshot}
      />
    </OfficeListPageShell>
  );
}
