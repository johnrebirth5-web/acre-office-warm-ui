import {
  canAccessOfficeCommissionWorkspace,
  canAccessOfficeSettings,
  canApproveOfficeCommissions,
  canCalculateOfficeCommissions,
  canManageOfficeCommissions,
  canViewOfficeCommissions
} from "@acre/auth";
import { getOfficeCommissionManagementSnapshot } from "@acre/db";
import { ListPageStack, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
import { CommissionManagementPanel } from "../../accounting/commission-management-panel";
import { OfficeSettingsNav } from "../settings-nav";

type OfficeSettingsCommissionPlansPageProps = {
  searchParams?: Promise<{
    commissionMembershipId?: string;
    commissionTeamId?: string;
    commissionPlanId?: string;
    commissionStatus?: string;
    commissionTransactionId?: string;
    commissionStartDate?: string;
    commissionEndDate?: string;
  }>;
};

export default async function OfficeSettingsCommissionPlansPage(props: OfficeSettingsCommissionPlansPageProps) {
  const context = await requireOfficeSession();
  const canAccessCommissionWorkspace = canAccessOfficeCommissionWorkspace(context.currentMembership);

  if (!canViewOfficeCommissions(context.currentMembership) || !canAccessCommissionWorkspace) {
    redirect(canAccessOfficeSettings(context.currentMembership) ? "/office/settings" : "/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeCommissionManagementSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    membershipId: searchParams.commissionMembershipId,
    teamId: searchParams.commissionTeamId,
    commissionPlanId: searchParams.commissionPlanId,
    status: searchParams.commissionStatus,
    transactionId: searchParams.commissionTransactionId,
    startDate: searchParams.commissionStartDate,
    endDate: searchParams.commissionEndDate
  });

  return (
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Split templates" tone="accent" value={snapshot.overview.activeSplitTemplatesCount} />
            <SummaryChip label="Member defaults" value={snapshot.overview.membersWithDefaultSplitCount} />
            <SummaryChip label="Calculated rows" value={snapshot.overview.calculatedRowsCount} />
          </>
        }
        title="Commission plans"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />
        <CommissionManagementPanel
          canApproveCommissions={canApproveOfficeCommissions(context.currentMembership)}
          canCalculateCommissions={canCalculateOfficeCommissions(context.currentMembership)}
          canManageCommissions={canManageOfficeCommissions(context.currentMembership)}
          canViewCommissions={canViewOfficeCommissions(context.currentMembership)}
          snapshot={snapshot}
        />
      </ListPageStack>
    </OfficeListPageShell>
  );
}
