import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  handleListingStudioPosterGet,
  normalizeListingStudioPosterEmbeddedImage,
} from "./route";

function createPosterRequest(
  search = "format=svg",
  origin = "http://127.0.0.1:3105",
  extraHeaders?: Record<string, string>,
) {
  return new NextRequest(
    `${origin}/api/listing-studio/listings/pack_123/poster?${search}`,
    {
      headers: {
        origin,
        ...extraHeaders,
      },
    },
  );
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["listing_studio:view"],
      role: "agent",
      title: "Licensed Real Estate Salesperson",
    },
    currentOrganization: {
      id: "org_1",
      name: "Acre Realty",
    },
    currentOffice: {
      id: "office_1",
      name: "Acre Manhattan",
    },
  } as never;
}

function createDetail() {
  return {
    addressLine: "31-14 34th Street #N3E",
    amenities: [],
    assets: [
      {
        id: "asset_1",
        kind: "hero",
        label: "Kitchen",
        mimeType: "image/jpeg",
      },
    ],
    bathrooms: 1,
    bedrooms: 1,
    buildingName: "The Neighborly",
    facts: [],
    floorPlans: [],
    locationLine: "Long Island City, NY",
    neighborhood: "Queens",
    pack: {
      companyFeedLabel: "Acre Realty",
      contactEmail: "agent@acre.test",
      contactName: "Acre Agent",
      contactPhone: "212-555-0101",
      contactTitle: "Licensed Real Estate Salesperson",
      coverAssetId: "asset_1",
      selectedAssetIds: ["asset_1"],
    },
    packId: "pack_123",
    priceLabel: "$875,000",
    sourceFacts: [],
    sqft: 658,
    title: "Poster Listing",
  } as never;
}

test("normalizeListingStudioPosterEmbeddedImage keeps svg-safe formats untouched", async () => {
  let importSharpCalls = 0;
  const buffer = Buffer.from("png-data");

  const result = await normalizeListingStudioPosterEmbeddedImage(
    buffer,
    "image/png; charset=utf-8",
    {
      importSharp: async () => {
        importSharpCalls += 1;
        throw new Error("should not be called");
      },
    },
  );

  assert.equal(importSharpCalls, 0);
  assert.equal(result.contentType, "image/png");
  assert.deepEqual(result.buffer, buffer);
});

test("normalizeListingStudioPosterEmbeddedImage converts non-svg-safe formats to jpeg", async () => {
  const result = await normalizeListingStudioPosterEmbeddedImage(
    Buffer.from("raw-image"),
    "image/webp",
    {
      importSharp: async () =>
        ((input: Buffer) => ({
          flatten() {
            return {
              jpeg() {
                return {
                  async toBuffer() {
                    return Buffer.concat([input, Buffer.from("-normalized")]);
                  },
                };
              },
            };
          },
        })) as never,
    },
  );

  assert.equal(result.contentType, "image/jpeg");
  assert.deepEqual(result.buffer, Buffer.from("raw-image-normalized"));
});

test("handleListingStudioPosterGet uses the forwarded public origin for svg previews", async () => {
  const captured = {
    options: null as Record<string, unknown> | null,
  };

  const response = await handleListingStudioPosterGet(
    createPosterRequest("format=svg", "http://127.0.0.1:3105", {
      host: "127.0.0.1:3105",
      "x-forwarded-host": "acresystem.us",
      "x-forwarded-proto": "https",
    }),
    "pack_123",
    {
      getAppBaseUrl: (request) => {
        const forwardedHost = request.headers.get("x-forwarded-host");
        const protocol = request.headers.get("x-forwarded-proto") ?? "http";
        return `${protocol}://${forwardedHost}`;
      },
      getOfficeAccountSnapshot: async () => null,
      getRequestSessionContext: async () => createSessionContext(),
      getStudioListingPackDetail: async () => createDetail(),
      importSharp: async () => {
        throw new Error("sharp should not be loaded for svg previews");
      },
      renderListingStudioPosterHtml: () => "<html />",
      renderListingStudioPosterSvg: async (_detail, _draft, options) => {
        captured.options = options as Record<string, unknown>;
        return "<svg />";
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(captured.options?.baseUrl, "https://acresystem.us");
  assert.equal(captured.options?.embedAssets, true);
  assert.equal(typeof captured.options?.normalizeEmbeddedImage, "function");
});
