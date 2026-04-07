import { can } from "@acre/auth";
import {
  createFollowUpTask,
  normalizeFrontOfficeAiFollowUpKind,
  normalizeFrontOfficeAiSourceSurface,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "clients:manage")) {
    return NextResponse.json(
      { error: "Client management access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const title = String(body.title ?? "").trim();
  const dueAt = typeof body.dueAt === "string" ? body.dueAt.trim() : "";

  if (!title) {
    return NextResponse.json(
      { error: "Task title is required." },
      { status: 400 },
    );
  }

  if (dueAt && !/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    return NextResponse.json(
      { error: "Due date must use YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  const acceptedAiActionValue =
    body.aiAcceptedAction && typeof body.aiAcceptedAction === "object"
      ? (body.aiAcceptedAction as Record<string, unknown>)
      : null;
  const acceptedAiAction =
    acceptedAiActionValue &&
    typeof acceptedAiActionValue.suggestionLabel === "string" &&
    acceptedAiActionValue.suggestionLabel.trim()
      ? {
          sourceSurface: normalizeFrontOfficeAiSourceSurface(
            typeof acceptedAiActionValue.sourceSurface === "string"
              ? acceptedAiActionValue.sourceSurface
              : null,
          ),
          suggestionKind: normalizeFrontOfficeAiFollowUpKind(
            typeof acceptedAiActionValue.suggestionKind === "string"
              ? acceptedAiActionValue.suggestionKind
              : null,
          ),
          suggestionLabel: acceptedAiActionValue.suggestionLabel.trim(),
          actionTitle:
            typeof acceptedAiActionValue.actionTitle === "string"
              ? acceptedAiActionValue.actionTitle.trim()
              : null,
        }
      : null;

  if (
    acceptedAiAction &&
    (!acceptedAiAction.sourceSurface || !acceptedAiAction.suggestionKind)
  ) {
    return NextResponse.json(
      { error: "Unsupported AI action context." },
      { status: 400 },
    );
  }

  const { clientId } = await params;
  const task = await createFollowUpTask({
    organizationId: context.currentOrganization.id,
    clientId,
    assigneeMembershipId: context.currentMembership.id,
    actorMembershipId: context.currentMembership.id,
    actorOfficeId: context.currentOffice?.id ?? null,
    title,
    dueAt,
    acceptedAiAction:
      acceptedAiAction &&
      acceptedAiAction.sourceSurface &&
      acceptedAiAction.suggestionKind
        ? {
            sourceSurface: acceptedAiAction.sourceSurface,
            suggestionKind: acceptedAiAction.suggestionKind,
            suggestionLabel: acceptedAiAction.suggestionLabel,
            actionTitle: acceptedAiAction.actionTitle,
          }
        : null,
  });

  if (!task) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ task }, { status: 201 });
}
