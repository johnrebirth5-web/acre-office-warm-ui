import { markProjectHandoffRecipientSubmitted } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { triggerProjectSignatureJobScanSoon } from "../../../../../../lib/project-signing-jobs";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const submitBodySchema = z.object({
  recipientId: z.string().trim().min(1),
  values: z
    .array(
      z.object({
        fieldId: z.string().trim().min(1),
        fieldType: z.string().trim().min(1),
        textValue: z.string().optional(),
        signatureMode: z.enum(["draw", "type", "upload"]).optional(),
        imageDataUrl: z.string().optional(),
      }),
    )
    .default([]),
});

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const { token } = await routeContext.params;
  const parsedBody = await parseJsonBody(request, submitBodySchema, {
    error: "Handoff signature payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const recipient = await markProjectHandoffRecipientSubmitted({
      rawToken: token,
      recipientId: parsedBody.data.recipientId,
      submittedValues: parsedBody.data.values,
    });

    triggerProjectSignatureJobScanSoon();

    return NextResponse.json({
      recipientId: recipient.id,
      status: recipient.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Handoff signature could not be submitted." },
      { status: 400 },
    );
  }
}
