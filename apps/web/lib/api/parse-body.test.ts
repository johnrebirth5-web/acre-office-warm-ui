import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  buildValidationErrorResponse,
  flattenZodFieldErrors,
  parseFormData,
  parseJsonBody,
} from "./parse-body";

test("parseJsonBody returns parsed data for a valid payload", async () => {
  const request = new Request("http://localhost/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Acre",
    }),
  });

  const result = await parseJsonBody(
    request,
    z.object({
      name: z.string().min(1),
    }),
  );

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.deepEqual(result.data, { name: "Acre" });
  }
});

test("parseJsonBody returns validation_error details for invalid JSON", async () => {
  const request = new Request("http://localhost/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{invalid",
  });

  const result = await parseJsonBody(
    request,
    z.object({
      name: z.string().min(1),
    }),
  );

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.deepEqual(result.fieldErrors, {
      body: "Request body must be valid JSON.",
    });
    assert.equal(result.response.status, 400);
    assert.deepEqual(await result.response.json(), {
      error: "Request body must be valid JSON.",
      errorCode: "validation_error",
      fieldErrors: {
        body: "Request body must be valid JSON.",
      },
    });
  }
});

test("parseFormData flattens field paths for schema failures", async () => {
  const formData = new FormData();
  formData.set("token", "");
  formData.set("password", "");

  const result = parseFormData(
    formData,
    z.object({
      token: z.string().min(1, "Token is required."),
      password: z.string().min(1, "Password is required."),
    }),
  );

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.deepEqual(result.fieldErrors, {
      token: "Token is required.",
      password: "Password is required.",
    });
  }
});

test("flattenZodFieldErrors formats nested array paths", () => {
  const schema = z.object({
    values: z.array(
      z.object({
        fieldId: z.string().min(1, "Field id is required."),
      }),
    ),
  });
  const parsed = schema.safeParse({
    values: [{}],
  });

  assert.equal(parsed.success, false);

  if (!parsed.success) {
    assert.deepEqual(flattenZodFieldErrors(parsed.error), {
      "values[0].fieldId": "Invalid input: expected string, received undefined",
    });
    const response = buildValidationErrorResponse(flattenZodFieldErrors(parsed.error));
    assert.equal(response.status, 400);
  }
});
