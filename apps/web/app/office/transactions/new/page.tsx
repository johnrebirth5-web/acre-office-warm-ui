import Link from "next/link";
import {
  canCreateOfficeTransactions,
  canManageOfficeFields,
  canManageOfficeTransactionStatus,
} from "@acre/auth";
import {
  getFrontOfficeHandoffPrefill,
  getOfficeFieldSettingsSnapshot,
  getOfficeTransactionIntakeSchema,
  getOfficeTransactionOwnerAssignment,
} from "@acre/db";
import { SectionCard, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { getServerI18n } from "../../../../lib/i18n/server";
import {
  OfficeDetailPageHeader,
  OfficeDetailPageShell,
} from "../../_components/office-detail-page-template";
import { getCreateTransactionStatusFieldPolicy } from "../transaction-status-rules";
import { TransactionCreatePageClient } from "./transaction-create-page-client";

type OfficeTransactionCreatePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type TransactionCreateLeadIn = {
  badgeLabel?: string;
  badgeTone?: "neutral" | "accent" | "success" | "warning" | "danger";
  title: string;
  description: string;
  items?: string[];
};

type FrontOfficeHandoffPrefillState = Awaited<
  ReturnType<typeof getFrontOfficeHandoffPrefill>
>;

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

const handoffTitleMap: Record<string, string> = {
  "Client handoff already used": "客户交接已使用",
  "Client handoff is already being submitted": "客户交接正在提交",
  "Client handoff needs review before save": "保存前需审核客户交接",
  "Client handoff no longer active": "客户交接不再有效",
  "Client handoff points to another workflow": "客户交接指向其他流程",
  "Client handoff ready for formal create": "客户交接可正式创建",
  "Client handoff unavailable": "客户交接不可用"
};

const handoffDescriptionMap: Record<string, string> = {
  "A Back Office create request is already finalizing this handoff. Wait a moment and reload this page before trying again so the formal transaction record does not get duplicated.":
    "一个 Back Office 创建请求正在完成此交接。请稍候并刷新页面后再重试，避免重复生成正式交易记录。",
  "The client page prepared the handoff. Create the formal Back Office record here when you are ready to move the transaction workflow over.":
    "客户页面已准备好交接。准备迁移交易流程时，可在此创建正式 Back Office 记录。",
  "The client page prepared this handoff, but some fields were inferred or are still missing. Review the items below before creating the formal Back Office record.":
    "客户页面已准备好此交接，但部分字段为推断值或仍缺失。创建正式 Back Office 记录前，请先检查下方项目。",
  "This client handoff could not be loaded from your current view. You can still create a manual Back Office transaction here, but it will not update the client page.":
    "当前视图无法加载此客户交接。你仍可在此手动创建 Back Office 交易，但不会更新客户页面。",
  "This handoff is already marked committed, but the linked Back Office record is unavailable from this view. Review the client page or transaction list before creating anything new.":
    "此交接已标记为已提交，但当前视图无法访问关联的 Back Office 记录。创建新记录前，请先检查客户页面或交易列表。",
  "This handoff was canceled on the client page, so creating a Back Office record from here would be a manual action only. Reconfirm the client details before continuing.":
    "此交接已在客户页面取消，因此从这里创建 Back Office 记录只会作为手动操作。继续前请重新确认客户信息。"
};

const handoffIssueLabelMap: Record<string, string> = {
  "Areas missing": "缺少区域",
  "Budget missing": "缺少预算",
  "Contact info missing": "缺少联系信息",
  "Intent inferred": "意向为推断值",
  "Owner needs review": "需要审核负责人"
};

const handoffIssueDescriptionMap: Record<string, string> = {
  "Front Office did not capture budget guidance. Add or verify financial context before Back Office workflow continues.":
    "Front Office 未记录预算指引。Back Office 流程继续前，请补充或核实财务背景。",
  "Front Office did not capture the client intent, so Back Office transaction type and representation were inferred. Review those selections before saving.":
    "Front Office 未记录客户意向，因此 Back Office 交易类型和代表方为推断值。保存前请检查这些选择。",
  "Preferred areas were not captured in Front Office. Review the transaction name and location context before formalizing the record.":
    "Front Office 未记录偏好区域。正式创建记录前，请检查交易名称和位置背景。",
  "The client page has no email or phone on this handoff. The transaction can still be created, but client contact details need manual review.":
    "此交接的客户页面没有邮箱或电话。交易仍可创建，但客户联系方式需要人工审核。",
  "This handoff did not carry a Front Office owner assignment. Confirm the Back Office owner before creating the formal transaction.":
    "此交接未带有 Front Office 负责人分配。创建正式交易前，请确认 Back Office 负责人。"
};

function translateHandoffTitle(value: string, isZh: boolean) {
  return isZh ? handoffTitleMap[value] ?? value : value;
}

function translateHandoffDescription(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  const exactDescription = handoffDescriptionMap[value];

  if (exactDescription) {
    return exactDescription;
  }

  const targetWorkflowMatch = value.match(
    /^This handoff is marked for (.+)\. Continue from the client page instead of opening the transaction create flow\.$/,
  );

  if (targetWorkflowMatch) {
    return `此交接标记为 ${targetWorkflowMatch[1]}。请从客户页面继续，不要打开交易创建流程。`;
  }

  const committedRecordMatch = value.match(
    /^This handoff already created a formal Back Office transaction\. Continue the formal workflow in that record instead of opening a second create flow\.$/,
  );

  if (committedRecordMatch) {
    return "此交接已创建正式 Back Office 交易。请在该记录中继续正式流程，不要打开第二个创建流程。";
  }

  return value;
}

function translateHandoffIssueLabel(value: string, isZh: boolean) {
  return isZh ? handoffIssueLabelMap[value] ?? value : value;
}

function translateHandoffIssueDescription(value: string, isZh: boolean) {
  return isZh ? handoffIssueDescriptionMap[value] ?? value : value;
}

function translateHandoffDisplayValue(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  if (value === "Areas not captured") {
    return "未填写区域";
  }

  if (value === "Budget not captured") {
    return "未填写预算";
  }

  return value;
}

function translateHandoffAcknowledgementLabel(value: string | undefined, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  if (
    value ===
    "I reviewed the missing or inferred client details and still want to create the formal Back Office transaction."
  ) {
    return "我已检查缺失或推断的客户信息，仍要创建正式 Back Office 交易。";
  }

  return value;
}

function buildPageTitle(handoffPrefill: FrontOfficeHandoffPrefillState | null, isZh: boolean) {
  if (!handoffPrefill || handoffPrefill.kind === "missing") {
    return isZh ? "新建交易" : "New transaction";
  }

  if (handoffPrefill.kind === "available") {
    return isZh ? `新建交易 · ${handoffPrefill.clientName}` : `New transaction · ${handoffPrefill.clientName}`;
  }

  if (handoffPrefill.kind === "committed") {
    return isZh ? "Front Office 交接已完成" : "Front Office handoff completed";
  }

  if (handoffPrefill.kind === "submitting") {
    return isZh ? "Front Office 交接正在提交" : "Front Office handoff is submitting";
  }

  if (handoffPrefill.kind === "unsupported_target") {
    return isZh ? "Front Office 交接不可用" : "Front Office handoff unavailable";
  }

  return isZh ? "新建交易" : "New transaction";
}

function buildPageDescription(
  handoffPrefill: FrontOfficeHandoffPrefillState | null,
  isZh: boolean,
) {
  if (!handoffPrefill) {
    return isZh ? "在此创建交易。Office 管理员可按需调整录入字段。" : "Create a transaction here. Office admins can adjust intake fields as needed.";
  }

  if (handoffPrefill.kind === "available") {
    return isZh
      ? `已从 Front Office 为 ${handoffPrefill.clientName} 预填。${translateHandoffDescription(handoffPrefill.feedbackDescription, isZh)}`
      : `Pre-filled from Front Office for ${handoffPrefill.clientName}. ${handoffPrefill.feedbackDescription}`;
  }

  return translateHandoffDescription(handoffPrefill.feedbackDescription, isZh);
}

function buildCreateLeadIn(
  handoffPrefill: FrontOfficeHandoffPrefillState | null,
  isZh: boolean,
): TransactionCreateLeadIn | undefined {
  if (!handoffPrefill || handoffPrefill.kind !== "available") {
    return undefined;
  }

  return {
    badgeLabel: isZh ? "Front Office 交接" : "Front Office handoff",
    badgeTone: handoffPrefill.isComplete ? "accent" : "warning",
    title: translateHandoffTitle(handoffPrefill.feedbackTitle, isZh),
    description: translateHandoffDescription(handoffPrefill.feedbackDescription, isZh),
    items: handoffPrefill.issues.map(
      (issue) => `${translateHandoffIssueLabel(issue.label, isZh)}${isZh ? "：" : ": "}${translateHandoffIssueDescription(issue.description, isZh)}`,
    ),
  };
}

function buildHandoffSummaryValue(
  handoffPrefill: Exclude<FrontOfficeHandoffPrefillState, null>,
  isZh: boolean,
) {
  switch (handoffPrefill.kind) {
    case "available":
      return translateHandoffDisplayValue(handoffPrefill.stageLabel, isZh);
    case "committed":
      return isZh ? "已交接" : "Handed off";
    case "submitting":
      return isZh ? "提交中" : "Submitting";
    case "canceled":
      return isZh ? "已取消" : "Canceled";
    case "unsupported_target":
      return isZh ? "其他流程" : "Other workflow";
    default:
      return "";
  }
}

export default async function OfficeTransactionCreatePage(
  props: OfficeTransactionCreatePageProps,
) {
  const context = await requireOfficeSession();
  const canManageFields = canManageOfficeFields(context.currentMembership);
  const canManageTransactionStatus = canManageOfficeTransactionStatus(
    context.currentMembership,
  );
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const searchParams = (await props.searchParams) ?? {};
  const handoffId = readSearchParamValue(searchParams.handoffId)?.trim() || "";

  if (!canCreateOfficeTransactions(context.currentMembership)) {
    redirect("/office/transactions");
  }

  const [schema, ownerAssignment, fieldSettingsSnapshot, handoffPrefill] =
    await Promise.all([
      getOfficeTransactionIntakeSchema({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
      }),
      getOfficeTransactionOwnerAssignment({
        organizationId: context.currentOrganization.id,
        viewerMembershipId: context.currentMembership.id,
        officeId: context.currentOffice?.id ?? null,
      }),
      getOfficeFieldSettingsSnapshot({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
        selectedModule: "transaction",
      }),
      handoffId
        ? getFrontOfficeHandoffPrefill({
            organizationId: context.currentOrganization.id,
            handoffDraftId: handoffId,
            officeId: context.currentOffice?.id ?? null,
          })
        : Promise.resolve(null),
    ]);

  const shouldShowCreateForm =
    !handoffPrefill || handoffPrefill.kind === "available";
  const createLeadIn = buildCreateLeadIn(handoffPrefill, isZh);
  const clientWorkspaceHref =
    handoffPrefill && handoffPrefill.kind !== "missing"
      ? handoffPrefill.clientWorkspaceHref
      : null;
  const committedTransactionHref =
    handoffPrefill?.kind === "committed"
      ? handoffPrefill.committedTransactionHref
      : null;

  return (
    <OfficeDetailPageShell className="office-transaction-create-page">
      <OfficeDetailPageHeader
        description={buildPageDescription(handoffPrefill, isZh)}
        summary={
          <>
            <Link
              className="office-button-secondary"
              href="/office/transactions"
            >
              {isZh ? "返回交易列表" : "Back to transactions"}
            </Link>
            {clientWorkspaceHref ? (
              <Link
                className="office-button-secondary office-button-sm"
                href={clientWorkspaceHref}
              >
                {isZh ? "打开 Front Office 客户" : "Open Front Office client"}
              </Link>
            ) : null}
            {committedTransactionHref ? (
              <Link
                className="office-button-secondary office-button-sm"
                href={committedTransactionHref}
              >
                {isZh ? "打开 Back Office 记录" : "Open Back Office record"}
              </Link>
            ) : null}
            {handoffPrefill && handoffPrefill.kind !== "missing" ? (
              <SummaryChip
                label={isZh ? "FO 交接" : "FO handoff"}
                tone={handoffPrefill.kind === "available" ? "accent" : "default"}
                value={buildHandoffSummaryValue(handoffPrefill, isZh)}
              />
            ) : null}
            {handoffPrefill?.kind === "available" ? (
              <SummaryChip
                label={isZh ? "预填" : "Prefill"}
                tone={handoffPrefill.isComplete ? "accent" : "default"}
                value={handoffPrefill.isComplete ? (isZh ? "就绪" : "Ready") : isZh ? "需审核" : "Needs review"}
              />
            ) : null}
            {handoffPrefill && handoffPrefill.kind !== "missing" ? (
              <SummaryChip label={isZh ? "区域" : "Areas"} value={translateHandoffDisplayValue(handoffPrefill.preferredAreasLabel, isZh)} />
            ) : null}
            {handoffPrefill && handoffPrefill.kind !== "missing" ? (
              <SummaryChip label={isZh ? "预算" : "Budget"} value={translateHandoffDisplayValue(handoffPrefill.budgetLabel, isZh)} />
            ) : null}
          </>
        }
        title={buildPageTitle(handoffPrefill, isZh)}
      />

      {shouldShowCreateForm ? (
        <TransactionCreatePageClient
          canManageFields={canManageFields}
          handoffPrefill={
            handoffPrefill?.kind === "available"
              ? {
                  handoffDraftId: handoffPrefill.handoffDraftId,
                  requiresAcknowledgement:
                    handoffPrefill.requiresAcknowledgement,
                  acknowledgementLabel:
                    translateHandoffAcknowledgementLabel(handoffPrefill.acknowledgementLabel, isZh),
                }
              : undefined
          }
          initialFieldModule={fieldSettingsSnapshot.currentModule}
          initialOwnerMembershipId={
            handoffPrefill?.kind === "available"
              ? handoffPrefill.ownerMembershipId ?? undefined
              : undefined
          }
          initialSchema={schema}
          initialValues={
            handoffPrefill?.kind === "available"
              ? handoffPrefill.initialValues
              : undefined
          }
          leadIn={createLeadIn}
          ownerAssignment={ownerAssignment}
          statusFieldPolicy={getCreateTransactionStatusFieldPolicy(
            canManageTransactionStatus,
            isZh,
          )}
        />
      ) : handoffPrefill ? (
        <SectionCard
          actions={
            <>
              <Link
                className="office-button-secondary office-button-sm"
                href="/office/transactions/new"
              >
                {isZh ? "手动新建" : "Create manually"}
              </Link>
              {clientWorkspaceHref ? (
                <Link
                  className="office-button-secondary office-button-sm"
                  href={clientWorkspaceHref}
                >
                  {isZh ? "重新打开 Front Office 档案" : "Reopen Front Office profile"}
                </Link>
              ) : null}
            </>
          }
          className="office-new-transaction-card office-new-transaction-live-card"
          title={translateHandoffTitle(handoffPrefill.feedbackTitle, isZh)}
          subtitle={translateHandoffDescription(handoffPrefill.feedbackDescription, isZh)}
        >
          <p>
            {handoffPrefill.kind === "committed"
              ? isZh
                ? "Front Office 已经交接此记录。请在关联的 Back Office 记录中继续正式交易流程，不要从此 URL 创建第二份文件。"
                : "Front Office already handed off this record. Continue the formal transaction workflow in the linked Back Office record instead of creating a second file from this URL."
              : handoffPrefill.kind === "submitting"
                ? isZh
                  ? "此交接已有 Back Office 创建请求正在处理中。请等待该请求完成后刷新页面，再判断是否需要其他操作。"
                  : "This handoff already has a Back Office create request in progress. Wait for that request to finish, then reload this page before deciding whether anything else is needed."
                : isZh
                  ? "此交接当前不能用于 Back Office 创建流程。如需刷新交接，请重新打开客户档案；也可以不使用此交接链接，明确手动新建。"
                  : "This handoff cannot currently be used for Back Office creation. Reopen the client profile if you need to refresh the handoff, or clearly create manually without this handoff link."}
          </p>
        </SectionCard>
      ) : null}
    </OfficeDetailPageShell>
  );
}
