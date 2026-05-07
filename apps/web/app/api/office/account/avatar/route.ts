import { saveOfficeAccountAvatar, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";
import { saveStoredProfileAvatarFile } from "../../../../../lib/document-storage";
import {
  formatUploadLimit,
  getOversizedUpload,
  isMultipartPayloadTooLarge,
} from "../../../../../lib/upload-validation";

export const runtime = "nodejs";

const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_AVATAR_MIN_DIMENSION_PX = 256;
const PROFILE_AVATAR_TARGET_SIZE_PX = 512;
const PROFILE_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type SharpFactory = (...args: any[]) => any;

type NormalizedProfileAvatar =
  | {
      bytes: Uint8Array;
      contentType: "image/webp";
      fileName: "profile-avatar.webp";
    }
  | {
      error: string;
      status: 400;
    };

type ProfileAvatarRouteDependencies = {
  importSharp?: () => Promise<SharpFactory>;
  normalizeProfileAvatarImage?: typeof normalizeProfileAvatarImage;
  saveOfficeAccountAvatar?: typeof saveOfficeAccountAvatar;
  saveStoredProfileAvatarFile?: typeof saveStoredProfileAvatarFile;
};

function isSupportedAvatarMimeType(value: string) {
  return PROFILE_AVATAR_MIME_TYPES.has(value.toLowerCase());
}

export function buildProfileAvatarUrl(storageKey: string) {
  return `/api/public/profile-avatar/${storageKey
    .split(/[\\/]+/)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export async function normalizeProfileAvatarImage(
  file: File,
  dependencies: Pick<ProfileAvatarRouteDependencies, "importSharp"> = {},
): Promise<NormalizedProfileAvatar> {
  try {
    const sharp = await (dependencies.importSharp?.() ??
      import("sharp").then((module) => module.default as SharpFactory));
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const image = sharp(inputBuffer, { animated: false, failOn: "error" }).rotate();
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (
      width < PROFILE_AVATAR_MIN_DIMENSION_PX ||
      height < PROFILE_AVATAR_MIN_DIMENSION_PX
    ) {
      return {
        error: `Avatar images must be at least ${PROFILE_AVATAR_MIN_DIMENSION_PX}x${PROFILE_AVATAR_MIN_DIMENSION_PX}px.`,
        status: 400,
      };
    }

    const outputBuffer = await image
      .resize(PROFILE_AVATAR_TARGET_SIZE_PX, PROFILE_AVATAR_TARGET_SIZE_PX, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 84, smartSubsample: true })
      .toBuffer();

    return {
      bytes: new Uint8Array(outputBuffer),
      contentType: "image/webp",
      fileName: "profile-avatar.webp",
    };
  } catch {
    return {
      error: "Avatar image could not be processed.",
      status: 400,
    };
  }
}

export async function handleProfileAvatarPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: ProfileAvatarRouteDependencies = {},
) {
  if (isMultipartPayloadTooLarge(request, PROFILE_AVATAR_MAX_BYTES)) {
    return NextResponse.json(
      {
        error: `Avatar uploads must be ${formatUploadLimit(PROFILE_AVATAR_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid avatar upload payload." }, { status: 400 });
  }

  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Avatar image is required." }, { status: 400 });
  }

  const oversizedFile = getOversizedUpload([file], PROFILE_AVATAR_MAX_BYTES);

  if (oversizedFile) {
    return NextResponse.json(
      {
        error: `Avatar uploads must be ${formatUploadLimit(PROFILE_AVATAR_MAX_BYTES)} or smaller.`,
      },
      { status: 413 },
    );
  }

  if (!isSupportedAvatarMimeType(file.type)) {
    return NextResponse.json(
      { error: `Unsupported avatar file type: ${file.type || "unknown"}` },
      { status: 400 },
    );
  }

  const normalizedAvatar = await (dependencies.normalizeProfileAvatarImage ??
    normalizeProfileAvatarImage)(file, dependencies);

  if ("error" in normalizedAvatar) {
    return NextResponse.json(
      { error: normalizedAvatar.error },
      { status: normalizedAvatar.status },
    );
  }

  const stored = await (dependencies.saveStoredProfileAvatarFile ??
    saveStoredProfileAvatarFile)({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    fileName: normalizedAvatar.fileName,
    bytes: normalizedAvatar.bytes,
  });
  const avatarUrl = buildProfileAvatarUrl(stored.storageKey);
  const saved = await (dependencies.saveOfficeAccountAvatar ??
    saveOfficeAccountAvatar)({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    avatarUrl,
  });

  if (!saved) {
    return NextResponse.json({ error: "Account profile not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, avatarUrl: saved.avatarUrl }, { status: 201 });
}

export async function POST(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return handleProfileAvatarPost(request, context);
}
