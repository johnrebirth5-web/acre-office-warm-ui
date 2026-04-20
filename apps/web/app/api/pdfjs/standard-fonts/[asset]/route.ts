import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    asset: string;
  }>;
};

const allowedExtensions = new Set([".pfb", ".ttf"]);

function getContentType(asset: string) {
  return asset.endsWith(".ttf") ? "font/ttf" : "application/octet-stream";
}

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: RouteContext) {
  const { asset } = await params;

  if (![...allowedExtensions].some((extension) => asset.endsWith(extension))) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const candidatePaths = [
    join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts", asset),
    join(process.cwd(), "..", "node_modules", "pdfjs-dist", "standard_fonts", asset),
    join(process.cwd(), "..", "..", "node_modules", "pdfjs-dist", "standard_fonts", asset)
  ];

  for (const candidatePath of candidatePaths) {
    try {
      const fileBuffer = await readFile(candidatePath);

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": getContentType(asset)
        }
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "Asset not found." }, { status: 404 });
}
