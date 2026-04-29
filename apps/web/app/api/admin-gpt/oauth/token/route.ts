import { NextRequest, NextResponse } from "next/server";
import {
  AdminGptOAuthError,
  exchangeAdminGptAuthorizationCode,
  readBasicClientCredentials,
} from "../../../../../lib/admin-gpt/oauth";

export const runtime = "nodejs";

function buildTokenErrorResponse(error: unknown) {
  const status = error instanceof AdminGptOAuthError ? error.status : 400;
  const code = error instanceof AdminGptOAuthError ? error.code : "invalid_request";
  const description = error instanceof Error ? error.message : "Acre Admin GPT token exchange failed.";

  return NextResponse.json(
    {
      error: code,
      error_description: description,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return buildTokenErrorResponse(
      new AdminGptOAuthError("invalid_request", "Invalid OAuth token request."),
    );
  }

  const basicCredentials = readBasicClientCredentials(request.headers.get("authorization"));
  const grantType = String(formData.get("grant_type") ?? "");

  if (grantType !== "authorization_code") {
    return buildTokenErrorResponse(
      new AdminGptOAuthError("unsupported_grant_type", "Acre Admin GPT only supports authorization_code token exchange."),
    );
  }

  try {
    const result = exchangeAdminGptAuthorizationCode({
      clientId: basicCredentials.clientId ?? String(formData.get("client_id") ?? ""),
      clientSecret: basicCredentials.clientSecret ?? String(formData.get("client_secret") ?? ""),
      code: String(formData.get("code") ?? ""),
      redirectUri: String(formData.get("redirect_uri") ?? ""),
    });

    return NextResponse.json(
      {
        access_token: result.accessToken,
        expires_in: result.expiresIn,
        scope: result.scope,
        token_type: result.tokenType,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return buildTokenErrorResponse(error);
  }
}
