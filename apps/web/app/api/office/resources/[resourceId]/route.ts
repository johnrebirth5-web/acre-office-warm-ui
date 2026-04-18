import {
  deleteOfficeResource,
  type SessionMembershipContext,
  updateOfficeResource,
} from "@acre/db";
import { ResourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import {
  deleteStoredFile,
  saveStoredResourceFile,
} from "../../../../../lib/document-storage";
import { isPdfFileLike } from "../../library/_shared/pdf-metadata";
import { requireOfficeAdminRequestContext } from "../_helpers";
import { updateOfficeResourceBodySchema } from "./route.schema";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    resourceId: string;
  }>;
};

type ResourceBody = {
  title?: string;
  summary?: string;
  url?: string | null;
  tags?: string[];
  type?: string;
  visibilityScope?: "organization_wide" | "office_only";
};

const sharedVisibilityScope = "organization_wide" as const;

type OfficeAdminContext = NonNullable<
  Awaited<ReturnType<typeof requireOfficeAdminRequestContext>>["context"]
>;

function parseTags(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeManagedResourceType(value: string | undefined) {
  if (value === ResourceType.training_video) {
    return ResourceType.training_video;
  }

  if (
    value === ResourceType.document ||
    value === ResourceType.playbook ||
    value === ResourceType.template
  ) {
    return ResourceType.document;
  }

  return null;
}

function inferDocumentMimeType(file: File) {
  if (isPdfFileLike(file.name, file.type)) {
    return "application/pdf";
  }

  return file.type || "application/octet-stream";
}

type OfficeResourceRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateOfficeResource?: typeof updateOfficeResource;
};

async function updateDocumentResource(
  request: NextRequest,
  context: OfficeAdminContext,
  resourceId: string,
) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      { error: "Invalid upload payload." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  const uploadedFile = fileEntry instanceof File && fileEntry.size > 0
    ? fileEntry
    : null;

  let storedFile:
    | {
        storageKey: string;
        fileSizeBytes: number;
      }
    | null = null;

  if (uploadedFile) {
    const fileBytes = new Uint8Array(await uploadedFile.arrayBuffer());
    storedFile = await saveStoredResourceFile({
      organizationId: context.currentOrganization.id,
      officeId: null,
      fileName: uploadedFile.name,
      bytes: fileBytes,
    });
  }

  try {
    const updated = await updateOfficeResource({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      resourceId,
      title: String(formData.get("title") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      tags: parseTags(formData.get("tags")),
      type: ResourceType.document,
      visibilityScope: sharedVisibilityScope,
      uploadedFile:
        uploadedFile && storedFile
          ? {
              originalFileName: uploadedFile.name,
              mimeType: inferDocumentMimeType(uploadedFile),
              fileSizeBytes: storedFile.fileSizeBytes,
              storageKey: storedFile.storageKey,
            }
          : null,
    });

    if (!updated) {
      if (storedFile) {
        await deleteStoredFile(storedFile.storageKey).catch(() => null);
      }

      return NextResponse.json(
        { error: "Resource not found." },
        { status: 404 },
      );
    }

    if (updated.previousStorageKey) {
      await deleteStoredFile(updated.previousStorageKey).catch(() => null);
    }

    return NextResponse.json({ resourceId: updated.id });
  } catch (error) {
    if (storedFile) {
      await deleteStoredFile(storedFile.storageKey).catch(() => null);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update resource.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  const { resourceId } = await params;
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (contentType.includes("multipart/form-data")) {
    return updateDocumentResource(request, access.context, resourceId);
  }

  return handleUpdateOfficeResourcePatch(
    request,
    resourceId,
    access.context,
  );
}

export async function handleUpdateOfficeResourcePatch(
  request: NextRequest,
  resourceId: string,
  context: OfficeAdminContext,
  dependencies: OfficeResourceRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeResourceBodySchema, {
    error: "A supported resource type is required.",
    invalidJsonError: "Resource request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;
  const type = ResourceType.training_video;

  try {
    const updated = await (
      dependencies.updateOfficeResource ?? updateOfficeResource
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      resourceId,
      title: String(body.title ?? ""),
      summary: String(body.summary ?? ""),
      url: body.url ?? "",
      tags: body.tags ?? [],
      type,
      visibilityScope: sharedVisibilityScope,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Resource not found." },
        { status: 404 },
      );
    }

    if (updated.previousStorageKey) {
      await deleteStoredFile(updated.previousStorageKey).catch(() => null);
    }

    return NextResponse.json({ resourceId: updated.id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update resource.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  const { resourceId } = await params;

  try {
    const removed = await deleteOfficeResource({
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      resourceId,
    });

    if (!removed.deleted) {
      return NextResponse.json(
        { error: "Resource not found." },
        { status: 404 },
      );
    }

    if (removed.storageKey) {
      await deleteStoredFile(removed.storageKey).catch(() => null);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete resource.",
      },
      { status: 400 },
    );
  }
}
