import {
  getOfficeFieldSettingsSnapshot,
  getOfficeTransactionOwnerAssignment,
  getOfficeTransactionsPageSnapshot
} from "@acre/db";
import { canManageOfficeFields, canManageOfficeTransactionStatus } from "@acre/auth";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getCreateTransactionStatusFieldPolicy } from "./transaction-status-rules";
import { TransactionsClient } from "./transactions-client";

type OfficeTransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const defaultTransactionsPage = 1;
const defaultTransactionsPageSize = 20;
const maxTransactionsPageSize = 100;

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

function parsePositiveInteger(value: string | string[] | undefined, fallback: number, max?: number) {
  const normalized = readSearchParamValue(value);
  const numeric = Number.parseInt(normalized ?? "", 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }

  return max ? Math.min(numeric, max) : numeric;
}

export default async function OfficeTransactionsPage(props: OfficeTransactionsPageProps) {
  const context = await requireOfficeSession();
  const canManageTransactionStatus = canManageOfficeTransactionStatus(context.currentMembership);
  const canManageSearchLayout = canManageOfficeFields(context.currentMembership);
  const searchParams = (await props.searchParams) ?? {};
  const page = parsePositiveInteger(searchParams.page, defaultTransactionsPage);
  const pageSize = parsePositiveInteger(
    searchParams.pageSize,
    defaultTransactionsPageSize,
    maxTransactionsPageSize
  );
  const [transactionsPageSnapshot, transactionOwnerAssignment, fieldSettingsSnapshot] = await Promise.all([
    getOfficeTransactionsPageSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      page,
      pageSize,
      searchParams
    }),
    getOfficeTransactionOwnerAssignment({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null
    }),
    getOfficeFieldSettingsSnapshot({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      selectedModule: "transaction"
    })
  ]);
  const { searchLayout, listResult: result } = transactionsPageSnapshot;

  return (
    <TransactionsClient
      canManageSearchLayout={canManageSearchLayout}
      page={result.page}
      pageSize={result.pageSize}
      searchLayout={searchLayout}
      summary={result.summary}
      totalCount={result.totalCount}
      totalPages={result.totalPages}
      transactionFieldModule={fieldSettingsSnapshot.currentModule}
      transactionOwnerAssignment={transactionOwnerAssignment}
      transactionStatusFieldPolicy={getCreateTransactionStatusFieldPolicy(canManageTransactionStatus)}
      transactions={result.transactions}
    />
  );
}
