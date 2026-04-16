import { deleteOfficeResource, updateOfficeResource } from "@acre/db";
import { ResourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireOfficeAdminRequestContext } from "../_helpers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    resourceId: string;
  }>;
};

type ResourceBody = {
  title?: string;
  summary?: string;
  url?: string;
  tags?: string[];
  type?: string;
  isPublished?: boolean;
  visibilityScope?: "organization_wide" | "office_only";
};

const allowedTypes = new Set<ResourceType>([
  ResourceType.playbook,
  ResourceType.template,
  ResourceType.document,
  ResourceType.training_video,
]);

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  const body = (await request.json().catch(() => null)) as ResourceBody | null;
  const type = body?.type as ResourceType | undefined;

  if (!type || !allowedTypes.has(type)) {
    return NextResponse.json(
      { error: "A supported resource type is required." },
      { status: 400 },
    );
  }

  const { resourceId } = await params;

  try {
    const updatedResourceId = await updateOfficeResource({
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      resourceId,
      title: String(body?.title ?? ""),
      summary: String(body?.summary ?? ""),
      url: String(body?.url ?? ""),
      tags: Array.isArray(body?.tags) ? body.tags : [],
      type,
      isPublished: Boolean(body?.isPublished),
      visibilityScope: body?.visibilityScope === "organization_wide"
        ? "organization_wide"
        : "office_only",
    });

    if (!updatedResourceId) {
      return NextResponse.json(
        { error: "Resource not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ resourceId: updatedResourceId });
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

    if (!removed) {
      return NextResponse.json(
        { error: "Resource not found." },
        { status: 404 },
      );
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
