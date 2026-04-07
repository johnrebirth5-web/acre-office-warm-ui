import {
  canEditOfficeContacts,
  canViewOfficeContacts,
} from "@acre/auth";
import { mergeFrontOfficeClients } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

function readRequiredString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : "";
}

function isPrismaRecordMissingError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

function buildMergeSuccessDetail() {
  return "Acre kept the surviving Front Office dossier and reconciled linked FO history plus existing Back Office contact pointers inside the same merge. No new transaction, outside-system sync, or auto-send step was created.";
}

function buildMergeErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message.trim() : "";

  if (message === "Choose two different client records to merge.") {
    return {
      status: 400,
      body: {
        code: "same_record",
        error: "Choose two different dossiers before merging.",
        detail:
          "The same client record was selected as both the keep dossier and the duplicate to merge in.",
        nextStep:
          "Reopen duplicate review and confirm which dossier should survive before retrying.",
      },
    };
  }

  if (
    message ===
      "Both duplicate records must still exist inside your visible Front Office CRM scope before merging." ||
    isPrismaRecordMissingError(error)
  ) {
    return {
      status: 409,
      body: {
        code: "scope_changed",
        error: "Acre could not merge these dossiers right now.",
        detail:
          "At least one record disappeared from your visible Front Office CRM scope before the merge finished. Another agent may already have merged, deleted, or re-scoped it.",
        nextStep:
          "Refresh duplicate review, reopen both records, and confirm the same keep dossier is still visible before retrying.",
      },
    };
  }

  return {
    status: 400,
    body: {
      code: "merge_failed",
      error: "Acre could not merge these Front Office dossiers.",
      detail:
        message ||
        "Acre stopped before deleting the duplicate dossier because the linked history could not be reconciled safely.",
      nextStep:
        "Review both dossiers again and retry only if the same keep / merge choice still makes sense.",
    },
  };
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      {
        code: "auth_required",
        error: "Authentication required.",
        detail:
          "Acre only allows duplicate merges from an authenticated Front Office session.",
        nextStep: "Sign in again, then reopen duplicate review.",
      },
      { status: 401 },
    );
  }

  if (
    !canViewOfficeContacts(context.currentMembership) ||
    !canEditOfficeContacts(context.currentMembership)
  ) {
    return NextResponse.json(
      {
        code: "forbidden",
        error: "Front Office client edit access required.",
        detail:
          "You can review duplicate dossiers in this scope, but you need contact edit access before Acre can merge them.",
        nextStep:
          "Ask an admin for client-edit access or have an authorized user complete the merge.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json(
      {
        code: "invalid_body",
        error: "A valid JSON body is required.",
        detail:
          "Acre did not receive the keep dossier and duplicate dossier IDs it needs to perform a safe merge.",
        nextStep: "Reload the page and start the merge again from duplicate review.",
      },
      { status: 400 },
    );
  }

  const targetClientId = readRequiredString(body, "targetClientId");
  const sourceClientId = readRequiredString(body, "sourceClientId");

  if (!targetClientId || !sourceClientId) {
    return NextResponse.json(
      {
        code: "missing_ids",
        error: "Both targetClientId and sourceClientId are required.",
        detail:
          "Acre needs one surviving dossier and one duplicate dossier before it can move linked history safely.",
        nextStep: "Reopen duplicate review and confirm both sides before retrying.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await mergeFrontOfficeClients({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id,
      actorOfficeId: context.currentOffice?.id ?? null,
      targetClientId,
      sourceClientId,
    });

    return NextResponse.json({
      result,
      detail: buildMergeSuccessDetail(),
      nextStep:
        "Open the surviving dossier if you want to re-check stage, next touch, or the FO -> BO boundary after the merge.",
    });
  } catch (error) {
    const mergeError = buildMergeErrorResponse(error);

    return NextResponse.json(mergeError.body, {
      status: mergeError.status,
    });
  }
}
