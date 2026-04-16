import { createOfficeResource } from "@acre/db";
import { ResourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  deleteStoredFile,
  saveStoredResourceFile,
} from "../../../../lib/document-storage";
import { isPdfFileLike } from "../library/_shared/pdf-metadata";
import { requireOfficeAdminRequestContext } from "./_helpers";

export const runtime = "nodejs";

type ResourceBody = {
  title?: string;
  summary?: string;
  url?: string | null;
  tags?: string[];
  type?: string;
  visibilityScope?: "organization_wide" | "office_only";
};

type OfficeAdminContext = NonNullable<
  Awaited<ReturnType<typeof requireOfficeAdminRequestContext>>["context"]
>;

function parseVisibilityScope(
  value: FormDataEntryValue | string | null | undefined,
) {
  return value === "organization_wide" ? "organization_wide" : "office_only";
}

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

async function createDocumentResource(
  request: NextRequest,
  context: OfficeAdminContext,
) {
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

  const fileBytes = new Uint8Array(await fileEntry.arrayBuffer());
  const storedFile = await saveStoredResourceFile({
    organizationId: context.currentOrganization.id,
    officeId:
      parseVisibilityScope(formData.get("visibilityScope")) === "office_only"
        ? context.currentOffice?.id ?? null
        : null,
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
      visibilityScope: parseVisibilityScope(formData.get("visibilityScope")),
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

  const body = (await request.json().catch(() => null)) as ResourceBody | null;
  const type = normalizeManagedResourceType(body?.type);

  if (type !== ResourceType.training_video) {
    return NextResponse.json(
      { error: "A supported resource type is required." },
      { status: 400 },
    );
  }

  try {
    const resourceId = await createOfficeResource({
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      title: String(body?.title ?? ""),
      summary: String(body?.summary ?? ""),
      url: body?.url ?? "",
      tags: Array.isArray(body?.tags) ? body.tags : [],
      type,
      visibilityScope: parseVisibilityScope(body?.visibilityScope),
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
