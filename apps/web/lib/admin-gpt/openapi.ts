export function buildAdminGptOpenApiDocument(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Acre Admin Help Actions",
      version: "1.0.0",
      description:
        "Read-only Acre administrator help actions for website usage guidance, feature lookup, and bug triage. These actions never modify code, database records, or production state.",
    },
    servers: [
      {
        url: baseUrl,
      },
    ],
    paths: {
      "/api/admin-gpt/context": {
        get: {
          operationId: "getAcreAdminHelpContext",
          summary: "Get current Acre admin context",
          description:
            "Returns role, organization, office, accessible offices, and the curated admin-help catalog. Does not return transactions, contacts, financial records, or chat history.",
          security: [{ acreAdminHelpOAuth: ["admin_help:read"] }],
          "x-openai-isConsequential": false,
          responses: {
            "200": {
              description: "Current administrator context and catalog summary.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminContextResponse" },
                },
              },
            },
          },
        },
      },
      "/api/admin-gpt/lookup": {
        post: {
          operationId: "lookupAcreAdminHelp",
          summary: "Look up Acre feature usage facts",
          description:
            "Searches a curated read-only Acre knowledge catalog for page purpose, routes, permissions, usage steps, availability, limitations, and bug signals.",
          security: [{ acreAdminHelpOAuth: ["admin_help:read"] }],
          "x-openai-isConsequential": false,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LookupRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Curated feature matches and answer boundary.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/LookupResponse" },
                },
              },
            },
          },
        },
      },
      "/api/admin-gpt/triage": {
        post: {
          operationId: "triageAcreAdminIssue",
          summary: "Triage an Acre admin usage or error report",
          description:
            "Classifies a user question, page path, visible error text, and screenshot summary as usage guidance, permission/configuration issue, likely bug, unavailable feature, or outside scope.",
          security: [{ acreAdminHelpOAuth: ["admin_help:read"] }],
          "x-openai-isConsequential": false,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TriageRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Read-only triage result and programmer handoff template.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TriageResponse" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        acreAdminHelpOAuth: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: `${baseUrl}/api/admin-gpt/oauth/authorize`,
              tokenUrl: `${baseUrl}/api/admin-gpt/oauth/token`,
              scopes: {
                "admin_help:read": "Read-only Acre admin help and troubleshooting guidance.",
              },
            },
          },
        },
      },
      schemas: {
        FeatureStatus: {
          type: "string",
          enum: ["available", "partial", "not_available"],
        },
        FeatureEntry: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            route: { type: ["string", "null"] },
            status: { $ref: "#/components/schemas/FeatureStatus" },
            audience: { type: "string" },
            summary: { type: "string" },
            howToUse: { type: "array", items: { type: "string" } },
            requiredAccess: { type: "string" },
            limitations: { type: "array", items: { type: "string" } },
            bugSignals: { type: "array", items: { type: "string" } },
            keywords: { type: "array", items: { type: "string" } },
          },
          required: [
            "id",
            "title",
            "route",
            "status",
            "audience",
            "summary",
            "howToUse",
            "requiredAccess",
            "limitations",
            "bugSignals",
            "keywords",
          ],
        },
        LookupRequest: {
          type: "object",
          additionalProperties: false,
          properties: {
            question: { type: "string" },
            currentPage: { type: "string" },
          },
        },
        LookupResponse: {
          type: "object",
          additionalProperties: true,
          properties: {
            scopeBoundary: { type: "string" },
            status: { type: "string", enum: ["matched", "unclear", "outside_scope"] },
            answerGuidance: { type: "string" },
            matches: { type: "array", items: { $ref: "#/components/schemas/FeatureEntry" } },
            fallback: { type: ["string", "null"] },
          },
          required: ["scopeBoundary", "status", "answerGuidance", "matches"],
        },
        TriageRequest: {
          type: "object",
          additionalProperties: false,
          properties: {
            question: { type: "string" },
            currentPage: { type: "string" },
            visibleErrorText: { type: "string" },
            screenshotSummary: { type: "string" },
          },
        },
        TriageResponse: {
          type: "object",
          additionalProperties: true,
          properties: {
            classification: {
              type: "string",
              enum: [
                "operator_guidance",
                "permission_or_access",
                "configuration",
                "likely_system_bug",
                "feature_not_available",
                "outside_scope",
                "unclear",
              ],
            },
            confidence: { type: "string", enum: ["low", "medium"] },
            scopeBoundary: { type: "string" },
            matchedFeatures: {
              type: "array",
              items: { $ref: "#/components/schemas/FeatureEntry" },
            },
            nextSteps: { type: "array", items: { type: "string" } },
            programmerHandoff: { type: "string" },
          },
          required: [
            "classification",
            "confidence",
            "scopeBoundary",
            "matchedFeatures",
            "nextSteps",
            "programmerHandoff",
          ],
        },
        AdminContextResponse: {
          type: "object",
          additionalProperties: true,
          properties: {
            assistantName: { type: "string" },
            privacy: { type: "string" },
            scopeBoundary: { type: "string" },
            currentAdmin: { type: "object", additionalProperties: true },
            currentOrganization: { type: "object", additionalProperties: true },
            currentOffice: { type: ["object", "null"], additionalProperties: true },
            accessibleOffices: { type: "array", items: { type: "object", additionalProperties: true } },
            catalog: { type: "object", additionalProperties: true },
          },
          required: [
            "assistantName",
            "privacy",
            "scopeBoundary",
            "currentAdmin",
            "currentOrganization",
            "currentOffice",
            "accessibleOffices",
            "catalog",
          ],
        },
      },
    },
  };
}
