import {
  canManageOfficeSettings,
  canManageOfficeSignatureTemplates,
} from "@acre/auth";
import {
  deleteOrganizationSignatureDriveSettings,
  getOfficeSignatureDriveSettingsSnapshot,
  saveOrganizationSignatureDriveSettings,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "../../../../../lib/with-permission";

type SaveSignatureDriveRequestBody = {
  isEnabled?: boolean;
  projectId?: string;
  clientEmail?: string;
  clientId?: string;
  privateKeyId?: string;
  privateKey?: string;
  sharedDriveId?: string;
  rootFolderId?: string;
  folderMappings?: {
    hr?: string;
    finance?: string;
    admin?: string;
    transaction?: string;
    generic?: string;
  };
} | null;

function canManageSignatureDrive(
  currentMembership: Parameters<typeof canManageOfficeSettings>[0],
) {
  return (
    canManageOfficeSettings(currentMembership) ||
    canManageOfficeSignatureTemplates(currentMembership)
  );
}

export async function GET(request: NextRequest) {
  return withPermission(
    request,
    canManageSignatureDrive,
    async (context) => {
      const snapshot = await getOfficeSignatureDriveSettingsSnapshot({
        organizationId: context.currentOrganization.id,
      });

      return NextResponse.json({ snapshot });
    },
    {
      forbiddenMessage: "Signature Drive settings access required.",
    },
  );
}

export async function PATCH(request: NextRequest) {
  return withPermission(
    request,
    canManageSignatureDrive,
    async (context) => {
      const body = (await request.json().catch(() => null)) as SaveSignatureDriveRequestBody;

      try {
        const snapshot = await saveOrganizationSignatureDriveSettings({
          organizationId: context.currentOrganization.id,
          actorMembershipId: context.currentMembership.id,
          isEnabled: Boolean(body?.isEnabled),
          projectId: body?.projectId ?? "",
          clientEmail: body?.clientEmail ?? "",
          clientId: body?.clientId ?? "",
          privateKeyId: body?.privateKeyId ?? "",
          privateKey: body?.privateKey ?? "",
          sharedDriveId: body?.sharedDriveId ?? "",
          rootFolderId: body?.rootFolderId ?? "",
          folderMappings: {
            hr: body?.folderMappings?.hr ?? "",
            finance: body?.folderMappings?.finance ?? "",
            admin: body?.folderMappings?.admin ?? "",
            transaction: body?.folderMappings?.transaction ?? "",
            generic: body?.folderMappings?.generic ?? "",
          },
        });

        return NextResponse.json({ snapshot });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to save Signature Drive settings.",
          },
          { status: 400 },
        );
      }
    },
    {
      forbiddenMessage: "Signature Drive settings access required.",
    },
  );
}

export async function DELETE(request: NextRequest) {
  return withPermission(
    request,
    canManageSignatureDrive,
    async (context) => {
      try {
        const snapshot = await deleteOrganizationSignatureDriveSettings({
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
                : "Failed to remove Signature Drive settings.",
          },
          { status: 400 },
        );
      }
    },
    {
      forbiddenMessage: "Signature Drive settings access required.",
    },
  );
}
