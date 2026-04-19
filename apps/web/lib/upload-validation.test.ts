import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_UPLOAD_BATCH_MAX_BYTES,
  DEFAULT_UPLOAD_MAX_BYTES,
  formatUploadLimit,
  getCombinedUploadSize,
  getOversizedUpload,
  getUnsupportedMimeUpload,
  hasAllowedMimePrefix,
  isMultipartPayloadTooLarge,
} from "./upload-validation";

test("multipart payload guard rejects content-length values above the configured limit", () => {
  assert.equal(
    isMultipartPayloadTooLarge(
      {
        headers: {
          get() {
            return String(DEFAULT_UPLOAD_MAX_BYTES + 1024 * 1024 + 1);
          },
        },
      },
      DEFAULT_UPLOAD_MAX_BYTES,
    ),
    true,
  );
});

test("upload helpers flag oversized files and unsupported mime prefixes", () => {
  const oversizedFile = new File(
    [new Uint8Array(DEFAULT_UPLOAD_MAX_BYTES + 1)],
    "oversized.png",
    { type: "image/png" },
  );
  const validImage = new File(["ok"], "listing.png", { type: "image/png" });
  const unknownMime = new File(["ok"], "listing.bin", { type: "" });

  assert.equal(getOversizedUpload([oversizedFile]), oversizedFile);
  assert.equal(hasAllowedMimePrefix(validImage, ["image/", "video/"]), true);
  assert.equal(hasAllowedMimePrefix(unknownMime, ["image/", "video/"]), false);
  assert.equal(
    getUnsupportedMimeUpload([validImage, unknownMime], ["image/", "video/"]),
    unknownMime,
  );
});

test("upload helpers report aggregate size and human readable limits", () => {
  const first = new File([new Uint8Array(10)], "first.txt", {
    type: "text/plain",
  });
  const second = new File([new Uint8Array(15)], "second.txt", {
    type: "text/plain",
  });

  assert.equal(getCombinedUploadSize([first, second]), 25);
  assert.equal(formatUploadLimit(DEFAULT_UPLOAD_BATCH_MAX_BYTES), "50 MB");
});
