import Link from "next/link";
import { canViewOfficeAgentBilling, getRoleSummary } from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { getOfficeBillingSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeBillingClient } from "./billing-client";

export default async function OfficeBillingPage() {
  const context = await requireOfficeSession();

  if (!canViewOfficeAgentBilling(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const snapshot = await getOfficeBillingSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id
  });

  if (!snapshot) {
    redirect("/office/dashboard");
  }
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell className="office-billing-page">
      <OfficeListPageHeader
        actions={
          <Link className="office-button-secondary office-button-sm" href="/office/activity?objectType=accounting">
            {isZh ? "打开账单记录" : "Open billing activity"}
          </Link>
        }
        description={
          isZh
            ? "查看自己的未结费用、付款、抵扣、账单摘要和付款方式引用。这里不执行在线扣款或 ACH。"
            : "Self-service billing visibility for outstanding charges, payments, credits, statements, and payment-method references. Live checkout and ACH execution are not implemented."
        }
        eyebrow={isZh ? "账单" : "Billing"}
        summary={
          <>
            <SummaryChip label={isZh ? "办公室范围" : "Office scope"} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={isZh ? "角色" : "Role"} value={getRoleSummary(context.currentMembership).label} />
            <SummaryChip label={isZh ? "未结余额" : "Outstanding balance"} tone="accent" value={snapshot.summary.outstandingBalanceLabel} />
          </>
        }
        title={isZh ? "我的账单" : "My billing"}
      />

      <OfficeBillingClient snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
