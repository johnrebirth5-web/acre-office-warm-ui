import {
  createOfficeResource,
  type SessionMembershipContext,
} from "@acre/db";
import { ResourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../lib/api/parse-body";
import {
  deleteStoredFile,
  saveStoredResourceFile,
} from "../../../../lib/document-storage";
import {
  DEFAULT_UPLOAD_MAX_BYTES,
  formatUploadLimit,
  getOversizedUpload,
  isMultipartPayloadTooLarge,
} from "../../../../lib/upload-validation";
import { isPdfFileLike } from "../library/_shared/pdf-metadata";
import { requireOfficeAdminRequestContext } from "./_helpers";
import { createOfficeResourceBodySchema } from "./route.schema";

export const runtime = "nodejs";

const OFFICE_RESOURCE_UPLOAD_MAX_BYTES = DEFAULT_UPLOAD_MAX_BYTES;

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

type OfficeResourcesRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createOfficeResource?: typeof createOfficeResource;
};

async function createDocumentResource(
  request: NextRequest,
  context: OfficeAdminContext,
) {
  if (isMultipartPayloadTooLarge(request, OFFICE_RESOURCE_UPLOAD_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Document uploads must be ${formatUploadLimit(OFFICE_RESOURCE_UPLOAD_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      { error: "Invalid upload payload." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "A PDF upload is required." },
      { status: 400 },
    );
  }

  if (getOversizedUpload([fileEntry], OFFICE_RESOURCE_UPLOAD_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Document uploads must be ${formatUploadLimit(OFFICE_RESOURCE_UPLOAD_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  const fileBytes = new Uint8Array(await fileEntry.arrayBuffer());
  const storedFile = await saveStoredResourceFile({
    organizationId: context.currentOrganization.id,
    officeId: null,
    fileName: fileEntry.name,
    bytes: fileBytes,
  });

  try {
    const resourceId = await createOfficeResource({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      title: String(formData.get("title") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      tags: parseTags(formData.get("tags")),
      type: ResourceType.document,
      visibilityScope: sharedVisibilityScope,
      uploadedFile: {
        originalFileName: fileEntry.name,
        mimeType: inferDocumentMimeType(fileEntry),
        fileSizeBytes: storedFile.fileSizeBytes,
        storageKey: storedFile.storageKey,
      },
    });

    return NextResponse.json({ resourceId }, { status: 201 });
  } catch (error) {
    await deleteStoredFile(storedFile.storageKey).catch(() => null);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create resource.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (contentType.includes("multipart/form-data")) {
    return createDocumentResource(request, access.context);
  }

  return handleCreateOfficeResourcePost(request, access.context);
}

export async function handleCreateOfficeResourcePost(
  request: NextRequest,
  context: OfficeAdminContext,
  dependencies: OfficeResourcesRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeResourceBodySchema, {
    error: "A supported resource type is required.",
    invalidJsonError: "Resource request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;
  const type = ResourceType.training_video;

  try {
    const resourceId = await (
      dependencies.createOfficeResource ?? createOfficeResource
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      title: String(body.title ?? ""),
      summary: String(body.summary ?? ""),
      url: body.url ?? "",
      tags: body.tags ?? [],
      type,
      visibilityScope: sharedVisibilityScope,
    });

    return NextResponse.json({ resourceId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create resource.",
      },
      { status: 400 },
    );
  }
}
