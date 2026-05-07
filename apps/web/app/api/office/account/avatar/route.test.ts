import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProfileAvatarUrl,
  handleProfileAvatarPost,
} from "./route";

function createAvatarRequest(formData: FormData | null, contentLength?: string) {
  return {
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-length" ? contentLength ?? null : null;
      },
    },
    async formData() {
      if (!formData) {
        throw new Error("formData unavailable");
      }

      return formData;
    },
  } as never;
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      role: "agent",
      permissions: [],
    },
    currentOffice: {
      id: "office_1",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("buildProfileAvatarUrl encodes stored avatar keys as public avatar URLs", () => {
  assert.equal(
    buildProfileAvatarUrl("org_1/profile-avatars/membership_1/head shot.png"),
    "/api/public/profile-avatar/org_1/profile-avatars/membership_1/head%20shot.png",
  );
});

test("handleProfileAvatarPost rejects unsupported avatar mime types", async () => {
  const formData = new FormData();
  formData.set("avatar", new File(["bad"], "avatar.svg", { type: "image/svg+xml" }));

  const response = await handleProfileAvatarPost(
    createAvatarRequest(formData),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Unsupported avatar file type: image/svg+xml",
  });
});

test("handleProfileAvatarPost stores the file and saves the public avatar URL", async () => {
  const formData = new FormData();
  formData.set("avatar", new File(["avatar"], "headshot.png", { type: "image/png" }));
  let capturedStorageInput: Record<string, unknown> | null = null;
  let capturedProfileInput: Record<string, unknown> | null = null;

  const response = await handleProfileAvatarPost(
    createAvatarRequest(formData),
    createSessionContext(),
    {
      saveStoredProfileAvatarFile: async (input) => {
        capturedStorageInput = {
          ...input,
          bytes: Array.from(input.bytes),
        };
        return {
          absolutePath: "/tmp/headshot.png",
          fileName: "headshot.png",
          fileSizeBytes: input.bytes.byteLength,
          storageKey: "org_1/profile-avatars/membership_1/headshot.png",
        };
      },
      saveOfficeAccountAvatar: async (input) => {
        capturedProfileInput = input as Record<string, unknown>;
        return {
          avatarUrl: input.avatarUrl,
        };
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedStorageInput, {
    organizationId: "org_1",
    membershipId: "membership_1",
    fileName: "headshot.png",
    bytes: [97, 118, 97, 116, 97, 114],
  });
  assert.deepEqual(capturedProfileInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_1",
    avatarUrl: "/api/public/profile-avatar/org_1/profile-avatars/membership_1/headshot.png",
  });
  assert.deepEqual(await readJson(response), {
    ok: true,
    avatarUrl: "/api/public/profile-avatar/org_1/profile-avatars/membership_1/headshot.png",
  });
});
