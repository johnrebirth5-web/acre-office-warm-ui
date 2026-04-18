import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "./lib/csrf";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const API_CSRF_EXEMPT_PATHS = new Set([
  "/api/listing-studio/extension/connect/start",
  "/api/listing-studio/imports",
]);

type ApiCsrfRequestLike = Pick<NextRequest, "method" | "headers" | "nextUrl">;

export function isCsrfSafeMethod(method: string) {
  return SAFE_METHODS.has(method.toUpperCase());
}

export function isApiCsrfExemptPath(pathname: string) {
  return API_CSRF_EXEMPT_PATHS.has(pathname);
}

export function shouldEnforceApiCsrf(request: Pick<NextRequest, "method" | "nextUrl">) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/api/")) {
    return false;
  }

  if (isCsrfSafeMethod(request.method)) {
    return false;
  }

  if (isApiCsrfExemptPath(pathname)) {
    return false;
  }

  return true;
}

export function buildApiCsrfFailureResponse() {
  const response = NextResponse.json(
    { error: "CSRF validation failed." },
    { status: 403 },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function validateApiCsrf(request: ApiCsrfRequestLike) {
  if (!shouldEnforceApiCsrf(request)) {
    return null;
  }

  if (isSameOriginRequest(request)) {
    return null;
  }

  return buildApiCsrfFailureResponse();
}

export function proxy(request: NextRequest) {
  return validateApiCsrf(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
