import { createHash } from "node:crypto";
import { prisma } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "../../../../lib/document-storage";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function hashDownloadToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export async function GET(_request: NextRequest, routeContext: RouteContext) {
  const { token } = await routeContext.params;
  const downloadToken = await prisma.projectDocumentDownloadToken.findUnique({
    where: {
      tokenHash: hashDownloadToken(token),
    },
    include: {
      signatureArtifact: true,
    },
  });

  if (
    !downloadToken ||
    downloadToken.revokedAt ||
    downloadToken.expiresAt.getTime() < Date.now() ||
    downloadToken.useCount >= downloadToken.maxUses
  ) {
    return NextResponse.json({ error: "Download link is invalid or expired." }, { status: 404 });
  }

  const storedFile = await readStoredFile(downloadToken.signatureArtifact.storageKey);
  const actualSha256 = sha256(new Uint8Array(storedFile.fileBuffer));

  if (downloadToken.signatureArtifact.contentSha256 && actualSha256 !== downloadToken.signatureArtifact.contentSha256) {
    await prisma.signatureAuditEntry.create({
      data: {
        signatureRequestId: downloadToken.signatureArtifact.signatureRequestId,
        eventType: "hash_mismatch",
        actorLabel: "Secure download",
        details: {
          expected: downloadToken.signatureArtifact.contentSha256,
          actual: actualSha256,
          source: "signature_artifact",
        },
      },
    });

    return NextResponse.json({ error: "Document integrity check failed." }, { status: 409 });
  }

  await prisma.projectDocumentDownloadToken.update({
    where: {
      id: downloadToken.id,
    },
    data: {
      useCount: {
        increment: 1,
      },
      consumedAt: downloadToken.useCount + 1 >= downloadToken.maxUses ? new Date() : downloadToken.consumedAt,
    },
  });

  return new NextResponse(storedFile.fileBuffer, {
    headers: {
      "Content-Type": downloadToken.signatureArtifact.mimeType,
      "Content-Disposition": `attachment; filename="${downloadToken.signatureArtifact.fileName.replace(/"/g, "'")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

