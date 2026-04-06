import { canViewOfficeOffers } from "@acre/auth";
import { listOfficeOffersQueue } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OffersClient } from "./offers-client";

type OfficeOffersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const defaultOffersPage = 1;
const defaultOffersPageSize = 20;
const maxOffersPageSize = 100;

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

export default async function OfficeOffersPage(props: OfficeOffersPageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeOffers(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const page = parsePositiveInteger(searchParams.page, defaultOffersPage);
  const pageSize = parsePositiveInteger(searchParams.pageSize, defaultOffersPageSize, maxOffersPageSize);
  const snapshot = await listOfficeOffersQueue({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    q: readSearchParamValue(searchParams.q),
    status: readSearchParamValue(searchParams.status),
    timing: readSearchParamValue(searchParams.timing),
    context: readSearchParamValue(searchParams.context),
    page,
    pageSize
  });

  return (
    <OffersClient
      officeScopeLabel={context.currentOffice?.name ?? context.currentOrganization.name}
      snapshot={snapshot}
    />
  );
}
