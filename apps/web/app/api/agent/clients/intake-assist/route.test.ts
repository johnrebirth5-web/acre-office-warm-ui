import assert from "node:assert/strict";
import test from "node:test";
import { FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES } from "../../../../../lib/front-office-intake-assist-server";
import { handleFrontOfficeLeadIntakeAssistServerRoute } from "../../../../../lib/front-office-intake-assist-server";

type RouteRequest = {
  formData(): Promise<FormData>;
};

function createRequest(formData: FormData | null): RouteRequest {
  return {
    async formData() {
      if (!formData) {
        throw new Error("formData unavailable");
      }

      return formData;
    },
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("returns 401 when the intake assist request is unauthenticated", async () => {
  const response = await handleFrontOfficeLeadIntakeAssistServerRoute(
    createRequest(new FormData()),
    null,
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    error: "Authentication required.",
  });
});

test("returns 403 when the current membership cannot view office contacts", async () => {
  const response = await handleFrontOfficeLeadIntakeAssistServerRoute(
    createRequest(new FormData()),
    {
      currentMembership: { role: "office_user", permissions: [] },
    } as never,
    {
      canViewOfficeContacts: () => false,
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Lead intake review access required.",
  });
});

test("returns 400 when the intake assist payload is empty after form parsing", async () => {
  const formData = new FormData();
  formData.set("sourceSurface", "dashboard");

  const response = await handleFrontOfficeLeadIntakeAssistServerRoute(
    createRequest(formData),
    {
      currentMembership: { role: "office_user", permissions: [] },
    } as never,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Add a screenshot or paste the chat transcript first so Acre has something to extract from.",
    sourceSurface: "dashboard",
    metadata: {
      ocr: {
        provider: "local_tesseract",
        mode: "server_side",
        attempted: false,
        succeeded: false,
        fallback: "none",
      },
      provenance: {
        transcript: {
          present: false,
          source: "none",
        },
        image: {
          present: false,
          source: "none",
          ocrAttempted: false,
          ocrSucceeded: false,
        },
        rawText: {
          sourceMode: "text",
          transcriptIncluded: false,
          ocrIncluded: false,
          fallbackUsed: false,
        },
      },
      warnings: [
        {
          code: "empty_payload",
          label: "No intake source supplied",
          detail:
            "Add a screenshot or paste the transcript so Acre has a source trail to review.",
        },
      ],
    },
  });
});

test("returns 413 when the uploaded screenshot exceeds the server OCR limit", async () => {
  const formData = new FormData();
  formData.set("sourceSurface", "dashboard");
  formData.set("image", new Blob([new Uint8Array(FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES + 1)], {
    type: "image/png",
  }), "lead.png");

  const response = await handleFrontOfficeLeadIntakeAssistServerRoute(
    createRequest(formData),
    {
      currentMembership: { role: "office_user", permissions: [] },
    } as never,
  );

  assert.equal(response.status, 413);
  assert.deepEqual(await readJson(response), {
    error: "That screenshot is too large for local OCR. Try a tighter crop under 10 MB.",
    sourceSurface: "dashboard",
    metadata: {
      ocr: {
        provider: "local_tesseract",
        mode: "server_side",
        attempted: false,
        succeeded: false,
        fallback: "none",
      },
      provenance: {
        transcript: {
          present: false,
          source: "none",
        },
        image: {
          present: true,
          source: "upload",
          ocrAttempted: false,
          ocrSucceeded: false,
        },
        rawText: {
          sourceMode: "image",
          transcriptIncluded: false,
          ocrIncluded: false,
          fallbackUsed: false,
        },
      },
      warnings: [
        {
          code: "oversized_image",
          label: "Screenshot too large for OCR",
          detail:
            "The uploaded image crossed the server OCR size limit, so Acre stopped before local Tesseract ran.",
        },
      ],
    },
  });
});

test("returns 200 with transcript fallback metadata when OCR yields no text", async () => {
  const formData = new FormData();
  formData.set("sourceSurface", "dashboard");
  formData.set("transcript", "Chat text line 1\nChat text line 2");
  formData.set(
    "image",
    new Blob(["fake screenshot bytes"], { type: "image/png" }),
    "lead.png",
  );

  const response = await handleFrontOfficeLeadIntakeAssistServerRoute(
    createRequest(formData),
    {
      currentMembership: { role: "office_user", permissions: [] },
    } as never,
    {
      extract: async ({ transcriptText }) => ({
        rawText: transcriptText ?? "",
        sourceMode: "hybrid",
        transcriptText: transcriptText ?? "",
        ocrText: "",
        hadImage: true,
        ocrSucceeded: false,
        transcriptFallbackUsed: true,
      metadata: {
        ocr: {
          provider: "local_tesseract",
          mode: "server_side",
          attempted: true,
          succeeded: false,
          fallback: "transcript",
        },
        provenance: {
          transcript: {
            present: true,
            source: "form_data",
            },
            image: {
              present: true,
              source: "upload",
              ocrAttempted: true,
              ocrSucceeded: false,
            },
            rawText: {
              sourceMode: "hybrid",
              transcriptIncluded: true,
              ocrIncluded: false,
              fallbackUsed: true,
            },
          },
          warnings: [
            {
              code: "ocr_failed",
              label: "Screenshot OCR returned no text",
              detail:
                "Acre ran local Tesseract on the server, but the image did not produce readable text.",
            },
            {
              code: "transcript_fallback",
              label: "Transcript used as fallback",
              detail:
                "The pasted transcript supplied the usable text after local Tesseract did not return a readable extract.",
            },
          ],
        },
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    rawText: "Chat text line 1\nChat text line 2",
    sourceMode: "hybrid",
    transcriptText: "Chat text line 1\nChat text line 2",
    ocrText: "",
    hadImage: true,
    ocrSucceeded: false,
    transcriptFallbackUsed: true,
    metadata: {
      ocr: {
        provider: "local_tesseract",
        mode: "server_side",
        attempted: true,
        succeeded: false,
        fallback: "transcript",
      },
      provenance: {
        transcript: {
          present: true,
          source: "form_data",
        },
        image: {
          present: true,
          source: "upload",
          ocrAttempted: true,
          ocrSucceeded: false,
        },
        rawText: {
          sourceMode: "hybrid",
          transcriptIncluded: true,
          ocrIncluded: false,
          fallbackUsed: true,
        },
      },
      warnings: [
        {
          code: "ocr_failed",
          label: "Screenshot OCR returned no text",
          detail:
            "Acre ran local Tesseract on the server, but the image did not produce readable text.",
        },
        {
          code: "transcript_fallback",
          label: "Transcript used as fallback",
          detail:
            "The pasted transcript supplied the usable text after local Tesseract did not return a readable extract.",
        },
      ],
    },
    sourceSurface: "dashboard",
  });
});
