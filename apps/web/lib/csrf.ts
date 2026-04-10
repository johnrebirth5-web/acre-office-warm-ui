import { getRequestOrigin } from "./request-origin";

type RequestLike = {
  headers: Pick<Headers, "get">;
  nextUrl: {
    host: string;
    protocol: string;
  };
};

function parseOriginHeader(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: RequestLike) {
  const requestOrigin = getRequestOrigin(request);
  const originHeader = parseOriginHeader(request.headers.get("origin"));

  if (originHeader) {
    return originHeader === requestOrigin;
  }

  const refererHeader = parseOriginHeader(request.headers.get("referer"));

  if (refererHeader) {
    return refererHeader === requestOrigin;
  }

  return false;
}
