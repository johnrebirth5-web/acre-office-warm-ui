import {
  getOfficeTransactionOwnerAssignment,
  getOfficeTransactionSearchLayoutSnapshot,
  listTransactions
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
  const [searchLayout, transactionOwnerAssignment] = await Promise.all([
    getOfficeTransactionSearchLayoutSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      searchParams
    }),
    getOfficeTransactionOwnerAssignment({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null
    })
  ]);
  const result = await listTransactions({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id,
    search: searchLayout.listFilters.q,
    status: searchLayout.listFilters.status,
    ownerMembershipId: searchLayout.listFilters.ownerMembershipId,
    teamId: searchLayout.listFilters.teamId,
    type: searchLayout.listFilters.type,
    startDate: searchLayout.listFilters.startDate,
    endDate: searchLayout.listFilters.endDate,
    fieldFilters: searchLayout.listFilters.fieldFilters,
    page,
    pageSize
  });

  return (
    <TransactionsClient
      canManageSearchLayout={canManageSearchLayout}
      page={result.page}
      pageSize={result.pageSize}
      searchLayout={searchLayout}
      summary={result.summary}
      totalCount={result.totalCount}
      totalPages={result.totalPages}
      transactionOwnerAssignment={transactionOwnerAssignment}
      transactionStatusFieldPolicy={getCreateTransactionStatusFieldPolicy(canManageTransactionStatus)}
      transactions={result.transactions}
    />
  );
}
