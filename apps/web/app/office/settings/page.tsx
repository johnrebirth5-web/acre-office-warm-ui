import Link from "next/link";
import {
  canAccessOfficeCommissionWorkspace,
  canAccessOfficeSettings,
  canManageOfficeSettings,
  canManageOfficeSignatureTemplates
} from "@acre/auth";
import { SectionCard, StatCard, SummaryChip } from "@acre/ui";
import { getOfficeSettingsSummarySnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeSettingsNav } from "./settings-nav";

export default async function OfficeSettingsPage() {
  const context = await requireOfficeSession();

  if (!canAccessOfficeSettings(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const snapshot = await getOfficeSettingsSummarySnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null
  });

  return (
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Active users" tone="accent" value={snapshot.summary.activeUsersCount} />
            <SummaryChip label="Teams" value={snapshot.summary.teamsCount} />
          </>
        }
        title="Settings"
      />

      <OfficeSettingsNav currentAccess={context.currentMembership} />

      <section className="office-settings-summary-grid">
        <StatCard hint="Current org scope" label="Users" value={snapshot.summary.usersCount} />
        <StatCard hint={`${snapshot.summary.activeUsersCount} active`} label="Teams" value={snapshot.summary.teamsCount} />
        <StatCard hint="Transaction workflow" label="Required roles" value={snapshot.summary.requiredRoleCount} />
        <StatCard hint="Reusable task templates" label="Checklists" value={snapshot.summary.checklistTemplateCount} />
      </section>

      <section className="office-settings-section-grid">
        <SectionCard subtitle="Members, access, and onboarding." title="Users">
          <Link className="office-settings-link" href="/office/settings/users">
            Open users
          </Link>
        </SectionCard>

        <SectionCard subtitle="Role templates and overrides." title="Roles">
          <Link className="office-settings-link" href="/office/settings/roles">
            Open role templates
          </Link>
        </SectionCard>

        {canManageOfficeSettings(context.currentMembership) ? (
          <SectionCard subtitle="Sender defaults for signature emails." title="Email delivery">
            <Link className="office-settings-link" href="/office/settings/email-delivery">
              Open email delivery
            </Link>
          </SectionCard>
        ) : null}

        <SectionCard subtitle="Operational roster structure." title="Teams">
          <Link className="office-settings-link" href="/office/settings/teams">
            Open teams
          </Link>
        </SectionCard>

        <SectionCard subtitle="Required contact roles and transaction field behavior." title="Fields">
          <Link className="office-settings-link" href="/office/settings/fields">
            Open field settings
          </Link>
        </SectionCard>

        <SectionCard subtitle="Reusable task templates." title="Checklists">
          <Link className="office-settings-link" href="/office/settings/checklists">
            Open checklist templates
          </Link>
        </SectionCard>

        {canManageOfficeSignatureTemplates(context.currentMembership) || canManageOfficeSettings(context.currentMembership) ? (
          <SectionCard subtitle="Google Drive archival for signed envelopes." title="Signature Drive">
            <Link className="office-settings-link" href="/office/settings/signature-drive">
              Open signature drive settings
            </Link>
          </SectionCard>
        ) : null}

        {canAccessOfficeCommissionWorkspace(context.currentMembership) ? (
          <SectionCard subtitle="Split templates and member defaults." title="Commission plans">
            <Link className="office-settings-link" href="/office/settings/commission-plans">
              Open commission plans
            </Link>
          </SectionCard>
        ) : null}
      </section>
    </OfficeListPageShell>
  );
}
