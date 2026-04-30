import { ProjectSigningSessionMode, SignatureRecipientRole } from "@prisma/client";
import { canCreateProjectSigning, createProjectSigningSession } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

const recipientSchema = z.object({
  membershipId: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1, "Recipient name is required."),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  role: z.enum([SignatureRecipientRole.signer, SignatureRecipientRole.approver, SignatureRecipientRole.cc]).optional(),
  recipientRole: z.string().trim().optional().nullable(),
  routingStep: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().min(0).optional().nullable(),
});

const createSessionBodySchema = z.object({
  mode: z.enum([ProjectSigningSessionMode.in_person, ProjectSigningSessionMode.remote]).default(ProjectSigningSessionMode.remote),
  templateIds: z.array(z.string().trim().min(1)).min(1, "Select at least one template."),
  buyerName: z.string().trim().optional().nullable(),
  buyerEmail: z.string().trim().optional().nullable(),
  buyerPhone: z.string().trim().optional().nullable(),
  responsibleMembershipId: z.string().trim().optional().nullable(),
  recipients: z.array(recipientSchema).default([]),
  expiresAt: z.string().datetime().optional().nullable(),
});

function buildProjectSigningContext(context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>) {
  return {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
  };
}

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const parsedBody = await parseJsonBody(request, createSessionBodySchema, {
    error: "Signing session payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { projectId } = await routeContext.params;

  try {
    const session = await createProjectSigningSession({
      ...buildProjectSigningContext(context),
      projectId,
      mode: parsedBody.data.mode,
      templateIds: parsedBody.data.templateIds,
      buyerName: parsedBody.data.buyerName ?? null,
      buyerEmail: parsedBody.data.buyerEmail ?? null,
      buyerPhone: parsedBody.data.buyerPhone ?? null,
      responsibleMembershipId: parsedBody.data.responsibleMembershipId ?? null,
      recipients: parsedBody.data.recipients,
      expiresAt: parsedBody.data.expiresAt ? new Date(parsedBody.data.expiresAt) : null,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signing session could not be created." },
      { status: 400 },
    );
  }
}

