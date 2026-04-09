"use client";

import type { ReactNode } from "react";

type FrontOfficeTrackedLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  tracking:
    | {
        type: "resource_open";
        resourceId: string;
      }
    | {
        type: "vendor_click";
        vendorId: string;
        action: "phone" | "email" | "website" | "primary";
      };
};

const interactionEndpoint = "/api/resources/interactions";

function isExternalHref(href: string) {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function recordInteraction(tracking: FrontOfficeTrackedLinkProps["tracking"]) {
  const body = JSON.stringify(tracking);

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    try {
      const payload = new Blob([body], { type: "application/json" });

      if (navigator.sendBeacon(interactionEndpoint, payload)) {
        return;
      }
    } catch {
      // Fall through to keepalive fetch.
    }
  }

  void fetch(interactionEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {
    // Tracking should not block the actual resource/vendor action.
  });
}

export function FrontOfficeTrackedLink(props: FrontOfficeTrackedLinkProps) {
  const externalHref = isExternalHref(props.href);

  return (
    <a
      className={props.className}
      href={props.href}
      onClick={() => {
        recordInteraction(props.tracking);
      }}
      rel={externalHref ? "noreferrer" : undefined}
      target={externalHref ? "_blank" : undefined}
    >
      {props.children}
    </a>
  );
}
