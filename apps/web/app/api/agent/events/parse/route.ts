import { can } from "@acre/auth";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import {
  canUseFrontOfficeEventOpenAi,
  parseFrontOfficeEventDraftWithOpenAi,
} from "../../../../../lib/front-office-event-openai";

function isJsonObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : null;
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "events:view")) {
    return NextResponse.json(
      { error: "Event access required." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);

  if (!isJsonObjectBody(body)) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const rawText = readOptionalString(body, "rawText") ?? "";

  if (!rawText) {
    return NextResponse.json(
      { error: "rawText is required." },
      { status: 400 },
    );
  }

  if (!canUseFrontOfficeEventOpenAi()) {
    return NextResponse.json({
      draft: null,
      source: "manual",
    });
  }

  try {
    return NextResponse.json({
      draft: await parseFrontOfficeEventDraftWithOpenAi({
        rawText,
      }),
      source: "openai",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not parse the event draft.";

    return NextResponse.json(
      {
        error: message,
        draft: null,
        source: "manual",
      },
      { status: 200 },
    );
  }
}
