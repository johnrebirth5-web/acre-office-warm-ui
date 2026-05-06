import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import { getOfficeAgentPayoutStatementsWorkspaceSnapshot } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeAccountingClient } from "./accounting-client";

type OfficeAccountingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

function readSearchParamArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean)));
  }

  if (typeof value !== "string") {
    return [];
  }

  return Array.from(new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean)));
}

export default async function OfficeAccountingPage(props: OfficeAccountingPageProps) {
  const context = await requireOfficeSession();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: readSearchParamValue(searchParams.membershipId),
    invoiceNumbers: readSearchParamArray(searchParams.invoiceNumber),
    statementId: readSearchParamValue(searchParams.statementId)
  });

  return (
    <OfficeListPageShell className="office-accounting-list-page">
      <OfficeListPageHeader
        description={
          isZh
            ? "按发票号生成经纪人付款单，保存可追溯快照，并下载 PDF。"
            : "Generate agent payout statements from selected invoice numbers, save a durable snapshot, and download a PDF."
        }
        eyebrow={isZh ? "财务" : "Accounting"}
        summary={
          <>
            <SummaryChip label={isZh ? "办公室范围" : "Office scope"} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={isZh ? "候选发票" : "Invoice candidates"} tone="accent" value={snapshot.filters.invoiceOptions.length} />
            <SummaryChip label={isZh ? "已保存付款单" : "Saved statements"} value={snapshot.history.length} />
            <SummaryChip label={isZh ? "当前依据" : "Current basis"} value={isZh ? "发票号" : "Invoice number"} />
          </>
        }
        title={isZh ? "经纪人付款单" : "Agent Statements"}
      />

      <OfficeAccountingClient snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
