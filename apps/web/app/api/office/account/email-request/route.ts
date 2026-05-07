import { createAdminEmailRequest, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

const accountEmailRequestSchema = z.object({
  notes: z.string().trim().max(1200).optional().nullable(),
  preferredEmailPrefix: z.string().trim().min(1).max(120),
});

type AccountEmailRequestRouteDependencies = {
  createAdminEmailRequest?: typeof createAdminEmailRequest;
  parseJsonBody?: typeof parseJsonBody;
};

function normalizePreferredEmailPrefix(value: string) {
  const prefix = value.trim().split("@")[0]?.trim().toLowerCase() ?? "";

  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(prefix)) {
    throw new Error(
      "Preferred email prefix can include lowercase letters, numbers, dots, underscores, and hyphens.",
    );
  }

  return prefix;
}

export async function handleAccountEmailRequestPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AccountEmailRequestRouteDependencies = {},
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    accountEmailRequestSchema,
    {
      error: "Email request payload is invalid.",
      invalidJsonError: "Email request body must be valid JSON.",
    },
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const preferredEmailPrefix = normalizePreferredEmailPrefix(
      parsedBody.data.preferredEmailPrefix,
    );
    const fullName =
      `${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() ||
      context.currentUser.email;
    const requesterNote = parsedBody.data.notes?.trim();
    const notes = [
      `Current sign-in email: ${context.currentUser.email}`,
      requesterNote ? `Requester note: ${requesterNote}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const emailRequest = await (dependencies.createAdminEmailRequest ??
      createAdminEmailRequest)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      fullName,
      preferredEmailPrefix,
      notes,
    });

    return NextResponse.json({ emailRequest }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create email request.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return handleAccountEmailRequestPost(request, context);
}
