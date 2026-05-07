import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProfileAvatarUrl,
  handleProfileAvatarPost,
  normalizeProfileAvatarImage,
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
      normalizeProfileAvatarImage: async (input) => {
        assert.equal(input.name, "headshot.png");
        return {
          bytes: new Uint8Array([119, 101, 98, 112]),
          contentType: "image/webp",
          fileName: "profile-avatar.webp",
        };
      },
      saveStoredProfileAvatarFile: async (input) => {
        capturedStorageInput = {
          ...input,
          bytes: Array.from(input.bytes),
        };
        return {
          absolutePath: "/tmp/profile-avatar.webp",
          fileName: "profile-avatar.webp",
          fileSizeBytes: input.bytes.byteLength,
          storageKey: "org_1/profile-avatars/membership_1/profile-avatar.webp",
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
    fileName: "profile-avatar.webp",
    bytes: [119, 101, 98, 112],
  });
  assert.deepEqual(capturedProfileInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_1",
    avatarUrl: "/api/public/profile-avatar/org_1/profile-avatars/membership_1/profile-avatar.webp",
  });
  assert.deepEqual(await readJson(response), {
    ok: true,
    avatarUrl: "/api/public/profile-avatar/org_1/profile-avatars/membership_1/profile-avatar.webp",
  });
});

test("normalizeProfileAvatarImage rejects images below the minimum avatar dimensions", async () => {
  const pipeline = {
    metadata: async () => ({
      height: 512,
      width: 128,
    }),
    resize() {
      return pipeline;
    },
    rotate() {
      return pipeline;
    },
    toBuffer: async () => Buffer.from("unused"),
    webp() {
      return pipeline;
    },
  };

  const result = await normalizeProfileAvatarImage(
    new File(["small"], "small.png", { type: "image/png" }),
    {
      importSharp: async () => (() => pipeline),
    },
  );

  assert.deepEqual(result, {
    error: "Avatar images must be at least 256x256px.",
    status: 400,
  });
});
