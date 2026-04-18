import { canManageOfficeSettings } from "@acre/auth";
import {
  deleteOrganizationSmtpSettings,
  getOfficeEmailDeliverySettingsSnapshot,
  saveOrganizationSmtpSettings,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { withPermission } from "../../../../../lib/with-permission";
import { saveEmailDeliveryBodySchema } from "./route.schema";

type EmailDeliveryRouteDependencies = {
  deleteOrganizationSmtpSettings?: typeof deleteOrganizationSmtpSettings;
  parseJsonBody?: typeof parseJsonBody;
  saveOrganizationSmtpSettings?: typeof saveOrganizationSmtpSettings;
};

export async function handleEmailDeliveryPatch(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: EmailDeliveryRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, saveEmailDeliveryBodySchema, {
    error: "Email delivery settings payload is invalid.",
    invalidJsonError: "Email delivery settings request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const snapshot = await (
      dependencies.saveOrganizationSmtpSettings ?? saveOrganizationSmtpSettings
    )({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      isEnabled: Boolean(parsedBody.data.isEnabled),
      host: parsedBody.data.host ?? "",
      port: parsedBody.data.port,
      secure: parsedBody.data.secure,
      user: parsedBody.data.user ?? "",
      password: parsedBody.data.password ?? "",
      fromEmail: parsedBody.data.fromEmail ?? "",
      fromName: parsedBody.data.fromName ?? "",
      replyTo: parsedBody.data.replyTo ?? "",
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save email delivery settings.",
      },
      { status: 400 },
    );
  }
}

export async function handleEmailDeliveryDelete(
  context: SessionMembershipContext,
  dependencies: EmailDeliveryRouteDependencies = {},
) {
  try {
    const snapshot = await (
      dependencies.deleteOrganizationSmtpSettings ??
      deleteOrganizationSmtpSettings
    )({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove email delivery settings.",
      },
      { status: 400 },
    );
  }
}

export async function GET(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => {
      const snapshot = await getOfficeEmailDeliverySettingsSnapshot({
        organizationId: context.currentOrganization.id,
      });

      return NextResponse.json({ snapshot });
    },
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}

export async function PATCH(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => handleEmailDeliveryPatch(request, context),
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}

export async function DELETE(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => handleEmailDeliveryDelete(context),
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}
