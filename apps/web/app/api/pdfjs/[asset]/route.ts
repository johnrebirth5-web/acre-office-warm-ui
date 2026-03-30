import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const allowedAssets = new Set(["pdf.mjs", "pdf.worker.mjs"]);

type RouteContext = {
  params: Promise<{
    asset: string;
  }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: RouteContext) {
  const { asset } = await params;

  if (!allowedAssets.has(asset)) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const candidatePaths = [
    join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", asset),
    join(process.cwd(), "..", "node_modules", "pdfjs-dist", "legacy", "build", asset),
    join(process.cwd(), "..", "..", "node_modules", "pdfjs-dist", "legacy", "build", asset)
  ];

  for (const candidatePath of candidatePaths) {
    try {
      const fileBuffer = await readFile(candidatePath);

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": "text/javascript; charset=utf-8"
        }
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "Asset not found." }, { status: 404 });
}
