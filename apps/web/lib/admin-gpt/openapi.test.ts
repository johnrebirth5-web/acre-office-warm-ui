import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminGptOpenApiDocument } from "./openapi";

test("buildAdminGptOpenApiDocument exposes only read-only non-consequential operations", () => {
  const document = buildAdminGptOpenApiDocument("https://acresystem.us") as {
    paths: Record<string, Record<string, Record<string, unknown>>>;
  };
  const operations = Object.values(document.paths).flatMap((pathItem) =>
    Object.entries(pathItem).map(([method, operation]) => ({
      method,
      operation,
    })),
  );

  assert.equal(operations.length, 3);

  for (const { method, operation } of operations) {
    assert.notEqual(method, "delete");
    assert.notEqual(method, "patch");
    assert.notEqual(method, "put");
    assert.equal(operation["x-openai-isConsequential"], false);
  }
});

test("buildAdminGptOpenApiDocument uses the supplied Acre base URL for OAuth", () => {
  const document = buildAdminGptOpenApiDocument("https://acresystem.us") as {
    components: {
      securitySchemes: {
        acreAdminHelpOAuth: {
          flows: {
            authorizationCode: {
              authorizationUrl: string;
              tokenUrl: string;
            };
          };
        };
      };
    };
  };
  const flow = document.components.securitySchemes.acreAdminHelpOAuth.flows.authorizationCode;

  assert.equal(flow.authorizationUrl, "https://acresystem.us/api/admin-gpt/oauth/authorize");
  assert.equal(flow.tokenUrl, "https://acresystem.us/api/admin-gpt/oauth/token");
});
