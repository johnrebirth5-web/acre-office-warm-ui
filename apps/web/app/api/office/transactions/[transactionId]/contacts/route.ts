import { canLinkOfficeContacts } from "@acre/auth";
import {
  linkContactToTransaction,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { linkOfficeTransactionContactBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

type OfficeTransactionContactsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  linkContactToTransaction?: typeof linkContactToTransaction;
};

export async function handleLinkOfficeTransactionContactPost(
  request: NextRequest,
  transactionId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionContactsRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, linkOfficeTransactionContactBodySchema, {
    error: "Transaction contact payload is invalid.",
    invalidJsonError: "Transaction contact request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const linked = await (
    dependencies.linkContactToTransaction ?? linkContactToTransaction
  )(context.currentOrganization.id, parsedBody.data.contactId, transactionId, {
    isPrimary: Boolean(parsedBody.data.isPrimary),
    actorMembershipId: context.currentMembership.id
  });

  if (!linked) {
    return NextResponse.json({ error: "Contact or transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canLinkOfficeContacts(context.currentMembership)) {
    return NextResponse.json({ error: "Contact linking access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  return handleLinkOfficeTransactionContactPost(request, transactionId, context);
}
