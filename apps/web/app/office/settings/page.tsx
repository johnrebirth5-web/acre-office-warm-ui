import Link from "next/link";
import { canAccessOfficeCommissionWorkspace, canAccessOfficeSettings, canManageOfficeSettings } from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SectionCard, StatCard, SummaryChip } from "@acre/ui";
import { getOfficeSettingsSummarySnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
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
    <PageShell className="office-list-page office-settings-list-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Active users" tone="accent" value={snapshot.summary.activeUsersCount} />
            <SummaryChip label="Teams" value={snapshot.summary.teamsCount} />
          </PageHeaderSummary>
        }
        eyebrow="Office admin"
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
        <SectionCard subtitle="Account access and member operations in one workspace." title="Users">
          <p className="office-settings-copy">
            Manage invitations, access state, office assignment, onboarding, goals, and operational member visibility from a unified route.
          </p>
          <Link className="office-settings-link" href="/office/settings/users">
            Open users
          </Link>
        </SectionCard>

        <SectionCard subtitle="Organization-wide role templates that seed effective permissions for every member." title="Roles">
          <p className="office-settings-copy">
            Edit the default permission template for each fixed Back Office role, then layer user-specific allow or deny overrides from
            the user detail page.
          </p>
          <Link className="office-settings-link" href="/office/settings/roles">
            Open role templates
          </Link>
        </SectionCard>

        {canManageOfficeSettings(context.currentMembership) ? (
          <SectionCard subtitle="Administrator-managed sender defaults plus Resend-ready delivery and SMTP fallback for signature requests." title="Email delivery">
            <p className="office-settings-copy">
              Configure the sender identity, reply-to defaults, and optional SMTP fallback that power outgoing signature request emails
              while API-based delivery can stay in env.
            </p>
            <Link className="office-settings-link" href="/office/settings/email-delivery">
              Open email delivery
            </Link>
          </SectionCard>
        ) : null}

        <SectionCard subtitle="Operational roster structure." title="Teams">
          <p className="office-settings-copy">
            Create teams, manage active/inactive rosters, and assign or remove agents without leaving Back Office.
          </p>
          <Link className="office-settings-link" href="/office/settings/teams">
            Open teams
          </Link>
        </SectionCard>

        <SectionCard subtitle="Required contact roles and transaction field behavior." title="Fields">
          <p className="office-settings-copy">
            Define required transaction roles and field visibility/requiredness so operational workflows stop depending on hardcoded defaults.
          </p>
          <Link className="office-settings-link" href="/office/settings/fields">
            Open field settings
          </Link>
        </SectionCard>

        <SectionCard subtitle="Reusable task templates for sales, rentals, and office defaults." title="Checklists">
          <p className="office-settings-copy">
            Create and manage reusable checklist templates that describe grouped task rows, due offsets, and document requirements.
          </p>
          <Link className="office-settings-link" href="/office/settings/checklists">
            Open checklist templates
          </Link>
        </SectionCard>

        {canAccessOfficeCommissionWorkspace(context.currentMembership) ? (
          <SectionCard subtitle="Default split templates, member-level defaults, and advanced legacy commission tools." title="Commission plans">
            <p className="office-settings-copy">
              Open the commission workspace to manage reusable split templates, review member defaults, and work through advanced plan settings.
            </p>
            <Link className="office-settings-link" href="/office/settings/commission-plans">
              Open commission plans
            </Link>
          </SectionCard>
        ) : null}
      </section>
    </PageShell>
  );
}
