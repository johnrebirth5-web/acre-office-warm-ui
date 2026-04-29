import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonBody,
  type ParsedBodyResult,
} from "../../../../lib/api/parse-body";
import { canAccessAdminGpt } from "../../../../lib/admin-gpt/access";
import {
  AdminAssistantGatewayBusyError,
  AdminAssistantGatewayUnavailableError,
  AdminAssistantInputRejectedError,
  callSerializedOpenClawAdminAssistant,
} from "../../../../lib/admin-gpt/codex-gateway";
import { getRequestSessionContext } from "../../../../lib/auth-session";
import { isSameOriginRequest } from "../../../../lib/csrf";
import {
  buildRateLimitKey,
  consumeRateLimit,
  type RateLimitConsumer,
  type RateLimitOptions,
} from "../../../../lib/rate-limit";
import { withApiGuard } from "../../../../lib/with-api-guard";

export const runtime = "nodejs";

const DEFAULT_ADMIN_ASSISTANT_RATE_LIMIT_OPTIONS = {
  limit: 8,
  windowMs: 5 * 60 * 1000,
};

const adminAssistantChatBodySchema = z.object({
  attachments: z
    .array(
      z.object({
        content: z.string().min(1).max(2_500_000),
        fileName: z.string().max(160).optional(),
        mimeType: z.string().min(1).max(80),
      }),
    )
    .max(3)
    .optional(),
  currentPath: z.string().max(300).optional(),
  history: z
    .array(
      z.object({
        content: z.string().max(1800),
        role: z.enum(["user", "assistant"]),
      }),
    )
    .max(8)
    .optional(),
  message: z.string().min(1).max(4000),
  sessionId: z.string().max(80).optional(),
});

type AdminAssistantChatRouteDependencies = {
  callAssistant?: typeof callSerializedOpenClawAdminAssistant;
  csrf?: typeof isSameOriginRequest;
  getRequestSessionContext?: typeof getRequestSessionContext;
  parseJsonBody?: typeof parseJsonBody;
  rateLimit?: RateLimitConsumer;
  rateLimitOptions?: RateLimitOptions;
  withApiGuard?: typeof withApiGuard;
};

type AdminAssistantChatBody = z.infer<typeof adminAssistantChatBodySchema>;

function getAdminAssistantRateLimitKey(request: NextRequest, membershipId: string) {
  return buildRateLimitKey(
    "admin-gpt/chat",
    request,
    membershipId || "anonymous",
  );
}

function buildNoStoreJson(payload: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function buildGatewayErrorResponse(error: unknown) {
  if (error instanceof AdminAssistantInputRejectedError) {
    return buildNoStoreJson(
      {
        error: error.message,
        errorCode: "validation_error",
      },
      400,
    );
  }

  if (error instanceof AdminAssistantGatewayBusyError) {
    return buildNoStoreJson(
      {
        error: "管理员助手正在回答上一个问题，请稍后再试。",
        errorCode: "assistant_busy",
      },
      429,
    );
  }

  if (error instanceof AdminAssistantGatewayUnavailableError) {
    return buildNoStoreJson(
      {
        error: "Codex OAuth 暂时不可用，请确认服务器上的 acre 用户已经完成 Codex OAuth 登录。",
        errorCode: "codex_oauth_unavailable",
      },
      503,
    );
  }

  console.error("[admin-gpt-chat] unexpected assistant error", error);

  return buildNoStoreJson(
    {
      error: "管理员助手暂时不可用，请稍后重试。",
      errorCode: "assistant_unavailable",
    },
    503,
  );
}

export async function handleAdminAssistantChatPost(
  request: NextRequest,
  dependencies: AdminAssistantChatRouteDependencies = {},
) {
  return (dependencies.withApiGuard ?? withApiGuard)<
    ParsedBodyResult<AdminAssistantChatBody>
  >(
    request,
    async ({ context, prepared }) => {
      if (!prepared.ok) {
        return prepared.response;
      }

      try {
        const result = await (dependencies.callAssistant ??
          callSerializedOpenClawAdminAssistant)(prepared.data, context!);

        return buildNoStoreJson({
          provider: result.provider,
          reply: result.reply,
          status: "ok",
        });
      } catch (error) {
        return buildGatewayErrorResponse(error);
      }
    },
    {
      cacheControlNoStore: true,
      canAccess: canAccessAdminGpt,
      csrf: dependencies.csrf ?? isSameOriginRequest,
      forbiddenMessage: "Admin assistant permission required.",
      getRequestSessionContext:
        dependencies.getRequestSessionContext ?? getRequestSessionContext,
      prepare: ({ request: guardedRequest }) =>
        (dependencies.parseJsonBody ?? parseJsonBody)(
          guardedRequest,
          adminAssistantChatBodySchema,
          {
            error: "Admin assistant request payload is invalid.",
            invalidJsonError:
              "Admin assistant request body must be valid JSON.",
          },
        ),
      rateLimit: {
        consumer: dependencies.rateLimit ?? consumeRateLimit,
        key: ({ context: guardContext, request: guardedRequest }) =>
          getAdminAssistantRateLimitKey(
            guardedRequest,
            guardContext!.currentMembership.id,
          ),
        message: "Too many admin assistant requests. Please try again in a moment.",
        options:
          dependencies.rateLimitOptions ??
          DEFAULT_ADMIN_ASSISTANT_RATE_LIMIT_OPTIONS,
      },
      requireAuth: true,
      unauthorizedMessage: "Authentication required.",
    },
  );
}

export async function POST(request: NextRequest) {
  return handleAdminAssistantChatPost(request);
}
