import { z } from "zod";

const AMOUNT_STRING_PATTERN = /^$|^-?\d+(\.\d{1,2})?$/;
const RATE_STRING_PATTERN = /^(\d+(\.\d{1,4})?|\d+%)$/;
const DOMAIN_ID_PATTERN = /^[a-z0-9_-]{10,64}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isAllowedUrlProtocol(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === "https:") {
      return true;
    }

    return process.env.NODE_ENV !== "production" && parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function amountString(message = "Enter a valid amount.") {
  return z.string().regex(AMOUNT_STRING_PATTERN, message);
}

export function rateString(message = "Enter a valid rate.") {
  return z.string().regex(RATE_STRING_PATTERN, message);
}

export function domainId(message = "Enter a valid identifier.") {
  return z.string().regex(DOMAIN_ID_PATTERN, message);
}

export function safeEmail(message = "Enter a valid email address.") {
  return z
    .string()
    .email(message)
    .max(254, "Email address is too long.");
}

export function safeUrl(message = "Enter a valid URL.") {
  return z.string().url(message).refine(isAllowedUrlProtocol, {
    message: "Only https URLs are allowed outside development.",
  });
}

export function isoDate(message = "Enter a valid ISO date.") {
  return z.string().regex(ISO_DATE_PATTERN, message);
}
