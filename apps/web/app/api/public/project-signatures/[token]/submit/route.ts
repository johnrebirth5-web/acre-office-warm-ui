import { markProjectSignatureSubmitted, resolveProjectRemoteSigningToken } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { triggerProjectSignatureJobScanSoon } from "../../../../../../lib/project-signing-jobs";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const submittedValueSchema = z.object({
  fieldId: z.string().trim().min(1),
  fieldType: z.string().trim().min(1),
  textValue: z.string().optional(),
  signatureMode: z.enum(["draw", "type", "upload"]).optional(),
  imageDataUrl: z.string().optional(),
});

const submitBodySchema = z.object({
  values: z.array(submittedValueSchema).default([]),
});

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const { token } = await routeContext.params;
  const resolved = await resolveProjectRemoteSigningToken(token);

  if (!resolved) {
    return NextResponse.json({ error: "Signing token is invalid or expired." }, { status: 404 });
  }

  if (resolved.otpRequired) {
    return NextResponse.json({ error: "OTP verification required before signing." }, { status: 403 });
  }

  const parsedBody = await parseJsonBody(request, submitBodySchema, {
    error: "Signature payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const recipient = await markProjectSignatureSubmitted({
      rawToken: token,
      submittedValues: parsedBody.data.values,
    });

    triggerProjectSignatureJobScanSoon();

    return NextResponse.json({
      recipientId: recipient.id,
      status: recipient.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signature could not be submitted." },
      { status: 400 },
    );
  }
}

