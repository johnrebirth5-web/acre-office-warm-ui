import { NextResponse } from "next/server";
import { readStoredFile } from "../../../../../lib/document-storage";

export const runtime = "nodejs";

function inferImageContentType(fileName: string) {
  const normalized = fileName.toLowerCase();

  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalized.endsWith(".gif")) {
    return "image/gif";
  }

  return "application/octet-stream";
}

function isSafeProfileAvatarStorageKey(segments: string[]) {
  return (
    segments.length >= 4 &&
    segments[1] === "profile-avatars" &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("/") &&
        !segment.includes("\\"),
    )
  );
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ storageKey: string[] }> },
) {
  const { storageKey } = await props.params;

  if (!isSafeProfileAvatarStorageKey(storageKey)) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  const storagePath = storageKey.join("/");
  const stored = await readStoredFile(storagePath).catch(() => null);

  if (!stored) {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(stored.fileBuffer), {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=604800, immutable",
      "Content-Length": String(stored.fileSizeBytes),
      "Content-Type": inferImageContentType(storageKey.at(-1) ?? ""),
    },
  });
}
