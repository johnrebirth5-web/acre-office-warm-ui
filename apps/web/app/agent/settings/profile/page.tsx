import { getRoleSummary } from "@acre/auth";
import { getOfficeAccountSnapshot } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../../lib/auth-session";
import { getServerI18n } from "../../../../lib/i18n/server";
import {
  OfficeListPageHeader,
  OfficeListPageShell,
} from "../../../office/_components/office-list-page-template";
import { AgentSettingsProfileClient } from "./profile-client";

export default async function AgentSettingsProfilePage() {
  const context = await requireSessionContext();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const snapshot = await getOfficeAccountSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
  });

  if (!snapshot) {
    redirect("/agent/dashboard");
  }

  return (
    <OfficeListPageShell className="agent-settings-profile-page office-account-page">
      <OfficeListPageHeader
        description={
          isZh
            ? "管理你的公开联系资料、Listing Studio 头像、电话、简介与执照信息。登录邮箱保持只读，需要通过管理员申请更改。"
            : "Manage your public contact profile, Listing Studio avatar, phone, bio, and license details. Your sign-in email stays read-only and changes by admin request."
        }
        eyebrow={isZh ? "设置" : "Settings"}
        summary={
          <>
            <SummaryChip
              label={isZh ? "办公室" : "Office"}
              value={
                context.currentOffice?.name ?? context.currentOrganization.name
              }
            />
            <SummaryChip
              label={isZh ? "角色" : "Role"}
              value={getRoleSummary(context.currentMembership).label}
            />
            <SummaryChip
              label={isZh ? "公开头像" : "Public avatar"}
              tone={snapshot.profile.avatarUrl ? "default" : "accent"}
              value={
                snapshot.profile.avatarUrl
                  ? isZh
                    ? "已设置"
                    : "Set"
                  : isZh
                    ? "未设置"
                    : "Missing"
              }
            />
          </>
        }
        title={isZh ? "个人资料" : "Profile settings"}
      />

      <AgentSettingsProfileClient snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
