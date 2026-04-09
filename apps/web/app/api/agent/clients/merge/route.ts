import { canEditOfficeContacts, canViewOfficeContacts } from "@acre/auth";
import { mergeFrontOfficeClients } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

function readRequiredString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : "";
}

function readPrismaErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "";
}

function isPrismaRecordMissingError(error: unknown) {
  return readPrismaErrorCode(error) === "P2025";
}

function buildMergeSuccessDetail() {
  return "Acre reconciled linked Front Office history plus existing Back Office contact pointers inside the same merge so the surviving dossier remains the single FO record. The same Clients workbench anchor stays ready for duplicate review if another pair is still waiting.";
}

function buildMergeKeepReason() {
  return "Acre keeps the dossier you explicitly reviewed and chose as the surviving record; the duplicate disappears only after linked history is moved safely, and the duplicate-review lane remains the return point for the next pair.";
}

function buildMergeBoundaryDetail() {
  return "This merge does not create a transaction, sync an outside system, or auto-send any follow-up. Re-open duplicate review or the surviving dossier from the same Clients workbench anchor when you are ready to verify the next step.";
}

function buildMergeErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  const prismaCode = readPrismaErrorCode(error);

  if (message === "Choose two different client records to merge.") {
    return {
      status: 400,
      body: {
        code: "same_record",
        error: "Choose two different dossiers before merging.",
        detail:
          "The same client record was selected as both the keep dossier and the duplicate to merge in.",
        nextStep:
          "Reopen duplicate review from the same Clients workbench anchor and confirm which dossier should survive before retrying.",
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
          "Refresh duplicate review from the same Clients workbench anchor, reopen both records, and confirm the same keep dossier is still visible before retrying.",
      },
    };
  }

  if (
    prismaCode === "P2002" ||
    prismaCode === "P2003" ||
    prismaCode === "P2028"
  ) {
    return {
      status: 409,
      body: {
        code: "linked_history_conflict",
        error: "Acre paused the merge to protect linked history.",
        detail:
          "A linked appointment, follow-up task, send record, or Back Office contact pointer changed while Acre was reconciling this pair, so the duplicate was left intact.",
        nextStep:
          "Refresh duplicate review from the same Clients workbench anchor, reopen both dossiers, and retry only if the keep choice is still correct.",
      },
    };
  }

  return {
    status: 500,
    body: {
      code: "merge_failed",
      error: "Acre could not merge these Front Office dossiers.",
      detail:
        message ||
        "Acre stopped before deleting the duplicate dossier because the linked history could not be reconciled safely.",
      nextStep:
        "Review both dossiers again from the Clients workbench anchor and retry only if the same keep / merge choice still makes sense.",
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
        nextStep:
          "Reload the page and start the merge again from duplicate review.",
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
        nextStep:
          "Reopen duplicate review and confirm both sides before retrying.",
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
      code: "merged",
      result,
      keepReason: buildMergeKeepReason(),
      detail: buildMergeSuccessDetail(),
      boundary: buildMergeBoundaryDetail(),
      returnToLabel: "Re-enter duplicate review",
      returnToHref: "/agent/clients?clientView=duplicate_review#duplicate-review",
      nextStep:
        "Return to duplicate review if another pair remains; otherwise open the surviving dossier from the same Clients workbench anchor to re-check stage, next touch, or the FO -> BO boundary.",
    });
  } catch (error) {
    const mergeError = buildMergeErrorResponse(error);

    return NextResponse.json(mergeError.body, {
      status: mergeError.status,
    });
  }
}
