import { canManageOfficeSettings } from "@acre/auth";
import {
  deleteOrganizationSmtpSettings,
  getOfficeEmailDeliverySettingsSnapshot,
  saveOrganizationSmtpSettings,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "../../../../../lib/with-permission";

type SaveEmailDeliveryRequestBody = {
  isEnabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
} | null;

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
    async (context) => {
      const body = (await request.json().catch(() => null)) as SaveEmailDeliveryRequestBody;

      try {
        const snapshot = await saveOrganizationSmtpSettings({
          organizationId: context.currentOrganization.id,
          actorMembershipId: context.currentMembership.id,
          isEnabled: Boolean(body?.isEnabled),
          host: body?.host ?? "",
          port: typeof body?.port === "number" ? body.port : undefined,
          secure: typeof body?.secure === "boolean" ? body.secure : undefined,
          user: body?.user ?? "",
          password: body?.password ?? "",
          fromEmail: body?.fromEmail ?? "",
          fromName: body?.fromName ?? "",
          replyTo: body?.replyTo ?? "",
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
    },
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}

export async function DELETE(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => {
      try {
        const snapshot = await deleteOrganizationSmtpSettings({
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
    },
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}
