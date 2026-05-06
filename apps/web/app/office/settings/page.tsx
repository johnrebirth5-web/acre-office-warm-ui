import { canAccessOfficeSettings } from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { getOfficeSettingsSummarySnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { KpiStrip } from "../../_components/kpi-strip";
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
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow={isZh ? "办公室管理" : "Office admin"}
        summary={
          <>
            <SummaryChip label={isZh ? "办公室范围" : "Office scope"} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={isZh ? "启用用户" : "Active users"} tone="accent" value={snapshot.summary.activeUsersCount} />
            <SummaryChip label={isZh ? "团队" : "Teams"} value={snapshot.summary.teamsCount} />
          </>
        }
        title={isZh ? "设置" : "Settings"}
      />

      <KpiStrip
        className="office-settings-summary-strip"
        items={[
          { label: isZh ? "用户" : "Users", value: snapshot.summary.usersCount },
          { label: isZh ? "团队" : "Teams", value: snapshot.summary.teamsCount },
          { label: isZh ? "必需角色" : "Required roles", value: snapshot.summary.requiredRoleCount },
          { label: isZh ? "清单" : "Checklists", value: snapshot.summary.checklistTemplateCount }
        ]}
      />

      <OfficeSettingsNav currentAccess={context.currentMembership} />
      <p className="office-settings-start-hint">{isZh ? "选择上方分区开始配置。" : "Pick a section above to start."}</p>
    </OfficeListPageShell>
  );
}
