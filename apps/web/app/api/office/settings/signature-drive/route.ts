import {
  canManageOfficeSettings,
  canManageOfficeSignatureTemplates,
} from "@acre/auth";
import {
  deleteOrganizationSignatureDriveSettings,
  getOfficeSignatureDriveSettingsSnapshot,
  saveOrganizationSignatureDriveSettings,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { withPermission } from "../../../../../lib/with-permission";
import { saveSignatureDriveBodySchema } from "./route.schema";

type SignatureDriveRouteDependencies = {
  deleteOrganizationSignatureDriveSettings?: typeof deleteOrganizationSignatureDriveSettings;
  parseJsonBody?: typeof parseJsonBody;
  saveOrganizationSignatureDriveSettings?: typeof saveOrganizationSignatureDriveSettings;
};

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

export async function handleSignatureDrivePatch(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: SignatureDriveRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, saveSignatureDriveBodySchema, {
    error: "Signature Drive settings payload is invalid.",
    invalidJsonError: "Signature Drive settings request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const snapshot = await (
      dependencies.saveOrganizationSignatureDriveSettings ??
      saveOrganizationSignatureDriveSettings
    )({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      isEnabled: Boolean(parsedBody.data.isEnabled),
      projectId: parsedBody.data.projectId ?? "",
      clientEmail: parsedBody.data.clientEmail ?? "",
      clientId: parsedBody.data.clientId ?? "",
      privateKeyId: parsedBody.data.privateKeyId ?? "",
      privateKey: parsedBody.data.privateKey ?? "",
      sharedDriveId: parsedBody.data.sharedDriveId ?? "",
      rootFolderId: parsedBody.data.rootFolderId ?? "",
      folderMappings: {
        hr: parsedBody.data.folderMappings?.hr ?? "",
        finance: parsedBody.data.folderMappings?.finance ?? "",
        admin: parsedBody.data.folderMappings?.admin ?? "",
        transaction: parsedBody.data.folderMappings?.transaction ?? "",
        generic: parsedBody.data.folderMappings?.generic ?? "",
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
}

export async function handleSignatureDriveDelete(
  context: SessionMembershipContext,
  dependencies: SignatureDriveRouteDependencies = {},
) {
  try {
    const snapshot = await (
      dependencies.deleteOrganizationSignatureDriveSettings ??
      deleteOrganizationSignatureDriveSettings
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
            : "Failed to remove Signature Drive settings.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  return withPermission(
    request,
    canManageSignatureDrive,
    async (context) => handleSignatureDrivePatch(request, context),
    {
      forbiddenMessage: "Signature Drive settings access required.",
    },
  );
}

export async function DELETE(request: NextRequest) {
  return withPermission(
    request,
    canManageSignatureDrive,
    async (context) => handleSignatureDriveDelete(context),
    {
      forbiddenMessage: "Signature Drive settings access required.",
    },
  );
}
