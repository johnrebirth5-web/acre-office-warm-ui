import { createHash, randomInt } from "node:crypto";
import { markProjectRecipientOtpVerified, prisma, resolveProjectRemoteSigningToken } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { sendSignatureRequestEmail } from "../../../../../../lib/signature-email";
import { getPublicAppBaseUrl } from "../../../../../../lib/request-origin";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const otpBodySchema = z.object({
  code: z.string().trim().optional(),
});

function hashOtp(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const { token } = await routeContext.params;
  const resolved = await resolveProjectRemoteSigningToken(token);

  if (!resolved) {
    return NextResponse.json({ error: "Signing token is invalid or expired." }, { status: 404 });
  }

  const parsedBody = await parseJsonBody(request, otpBodySchema, {
    error: "OTP payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  if (resolved.recipient.otpVerifiedAt) {
    return NextResponse.json({ verified: true });
  }

  if (resolved.recipient.otpLockedUntil && resolved.recipient.otpLockedUntil.getTime() > Date.now()) {
    return NextResponse.json({ error: "Too many OTP attempts. Try again later." }, { status: 429 });
  }

  const code = parsedBody.data.code?.trim();

  if (!code) {
    const nextCode = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.projectSigningSessionRecipient.update({
      where: {
        id: resolved.recipient.id,
      },
      data: {
        otpHash: hashOtp(nextCode),
        otpExpiresAt: expiresAt,
        otpFailedAttempts: 0,
        otpLockedUntil: null,
      },
    });

    if (resolved.recipient.email) {
      await sendSignatureRequestEmail({
        organizationId: resolved.recipient.organizationId,
        to: resolved.recipient.email,
        subject: "Acre signing verification code",
        message: `Your Acre signing verification code is ${nextCode}. It expires in 10 minutes.`,
        signingLink: `${getPublicAppBaseUrl()}/sign/session/${encodeURIComponent(token)}`,
        documentTitle: "Project signing verification",
        expiresAt: expiresAt.toISOString(),
        senderDisplayName: "Acre Project Signing",
      });
    }

    return NextResponse.json({ otpSent: true });
  }

  if (!resolved.recipient.otpHash || !resolved.recipient.otpExpiresAt || resolved.recipient.otpExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "OTP expired. Request a new code." }, { status: 400 });
  }

  if (hashOtp(code) !== resolved.recipient.otpHash) {
    const attempts = resolved.recipient.otpFailedAttempts + 1;
    await prisma.projectSigningSessionRecipient.update({
      where: {
        id: resolved.recipient.id,
      },
      data: {
        otpFailedAttempts: attempts,
        otpLockedUntil: attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null,
      },
    });

    return NextResponse.json({ error: "OTP code is incorrect." }, { status: 400 });
  }

  await markProjectRecipientOtpVerified(resolved.recipient.id);

  return NextResponse.json({ verified: true });
}
