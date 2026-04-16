"use client";

import { useEffect, useState } from "react";
import type { FrontOfficeResourceRecord } from "@acre/db";
import { StatusBadge } from "@acre/ui";
import { FrontOfficeTrackedLink } from "../_components/front-office-tracked-link";

const interactionEndpoint = "/api/resources/interactions";

const resourceCardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.8rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "#ffffff",
};

const resourceHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.8rem",
};

const resourceTitleRowStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.8rem",
};

const resourceTitleWrapStyle = {
  flex: "1 1 auto",
  minWidth: 0,
};

const resourceBadgeWrapStyle = {
  flexShrink: 0,
};

const metaRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.83rem",
  lineHeight: 1.4,
};

const tagRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
};

const tagStyle = {
  padding: "0.18rem 0.56rem",
  borderRadius: "999px",
  background: "rgba(18, 53, 104, 0.07)",
  color: "#58708a",
  fontSize: "0.78rem",
  fontWeight: 600,
  lineHeight: 1.3,
};

const actionRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px 12px",
  marginTop: "auto",
  justifyContent: "flex-end",
  paddingTop: "0.25rem",
};

const gridStyle = {
  display: "grid",
  gap: "1rem",
};

const overlayStyle = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 80,
  background: "rgba(8, 17, 32, 0.62)",
  backdropFilter: "blur(12px)",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  padding: "1rem",
};

const shellStyle = {
  display: "grid",
  gridTemplateRows: "auto 1fr",
  width: "min(1520px, 100%)",
  minHeight: "100%",
  borderRadius: "28px",
  overflow: "hidden",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  background:
    "linear-gradient(180deg, rgba(244, 248, 252, 0.98) 0%, rgba(233, 239, 247, 0.98) 100%)",
  boxShadow: "0 32px 80px rgba(8, 17, 32, 0.32)",
};

const chromeStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "0.9rem 1rem",
  borderBottom: "1px solid rgba(18, 53, 104, 0.1)",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 249, 253, 0.92) 100%)",
};

const chromeDotsStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  flexShrink: 0,
};

const dotStyle = (color: string) => ({
  width: "0.72rem",
  height: "0.72rem",
  borderRadius: "999px",
  background: color,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
});

const addressBarStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  minWidth: 0,
  flex: "1 1 auto",
  padding: "0.75rem 1rem",
  borderRadius: "999px",
  background: "rgba(18, 53, 104, 0.06)",
  border: "1px solid rgba(18, 53, 104, 0.08)",
};

const iframeWrapStyle = {
  position: "relative" as const,
  minHeight: 0,
  background: "#050b16",
};

const iframeStyle = {
  width: "100%",
  height: "100%",
  border: 0,
  display: "block",
};

const placeholderStyle = {
  position: "absolute" as const,
  inset: 0,
  display: "grid",
  placeItems: "center",
  color: "rgba(255,255,255,0.82)",
  fontSize: "1rem",
  letterSpacing: "-0.01em",
};

type VideoPlayerState = {
  id: string;
  title: string;
  href: string;
};

function isYouTubeUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return (
      parsedUrl.protocol === "https:" &&
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
      ].includes(parsedUrl.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function getYouTubeVideoId(value: string) {
  try {
    const parsedUrl = new URL(value);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (hostname === "youtu.be") {
      return parsedUrl.pathname.replace(/^\/+/, "").split("/")[0] || null;
    }

    if (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com"
    ) {
      if (parsedUrl.pathname === "/watch") {
        return parsedUrl.searchParams.get("v");
      }

      if (
        parsedUrl.pathname.startsWith("/embed/") ||
        parsedUrl.pathname.startsWith("/shorts/")
      ) {
        return parsedUrl.pathname.split("/")[2] || null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function buildEmbedHref(value: string) {
  const videoId = getYouTubeVideoId(value);

  if (!videoId) {
    return null;
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
}

function recordResourceOpen(resourceId: string) {
  const body = JSON.stringify({
    type: "resource_open",
    resourceId,
  });

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
    // Tracking should not block playback.
  });
}

function TrainingRecordCard(props: {
  resource: FrontOfficeResourceRecord;
  onPlay: (video: VideoPlayerState) => void;
}) {
  const { resource, onPlay } = props;

  return (
    <article style={resourceCardStyle}>
      <div style={resourceHeaderStyle}>
        <div style={{ display: "grid", gap: "0.5rem", width: "100%" }}>
          <div style={resourceTitleRowStyle}>
            <strong style={resourceTitleWrapStyle}>{resource.title}</strong>
            <div
              style={{
                ...resourceBadgeWrapStyle,
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <StatusBadge tone="warning">{resource.typeLabel}</StatusBadge>
              {isYouTubeUrl(resource.href) ? (
                <StatusBadge tone="accent">YouTube</StatusBadge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div style={metaRowStyle}>
        <span>YouTube video</span>
        <span>{resource.detailLabel}</span>
        <span>{resource.freshnessLabel}</span>
      </div>

      {resource.tags.length ? (
        <div style={tagRowStyle}>
          {resource.tags.map((tag) => (
            <span key={tag} style={tagStyle}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div style={actionRowStyle}>
        <button
          className="office-button-secondary office-button-sm"
          onClick={() =>
            onPlay({
              id: resource.id,
              title: resource.title,
              href: resource.href,
            })
          }
          type="button"
        >
          Watch full screen
        </button>
      </div>
    </article>
  );
}

export function FrontOfficeTrainingGallery(props: {
  resources: FrontOfficeResourceRecord[];
}) {
  const [activeVideo, setActiveVideo] = useState<VideoPlayerState | null>(null);

  useEffect(() => {
    if (!activeVideo) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveVideo(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeVideo]);

  const embedHref = activeVideo ? buildEmbedHref(activeVideo.href) : null;

  function handlePlay(video: VideoPlayerState) {
    recordResourceOpen(video.id);
    setActiveVideo(video);
  }

  return (
    <>
      <div style={gridStyle}>
        {props.resources.map((resource) => (
          <TrainingRecordCard
            key={resource.id}
            onPlay={handlePlay}
            resource={resource}
          />
        ))}
      </div>

      {activeVideo ? (
        <div
          aria-modal="true"
          onClick={() => setActiveVideo(null)}
          role="dialog"
          style={overlayStyle}
        >
          <div onClick={(event) => event.stopPropagation()} style={shellStyle}>
            <div style={chromeStyle}>
              <div style={chromeDotsStyle}>
                <span aria-hidden="true" style={dotStyle("#ff5f57")} />
                <span aria-hidden="true" style={dotStyle("#febc2e")} />
                <span aria-hidden="true" style={dotStyle("#28c840")} />
              </div>
              <div style={addressBarStyle}>
                <div
                  style={{
                    display: "grid",
                    gap: "0.15rem",
                    minWidth: 0,
                    flex: "1 1 auto",
                  }}
                >
                  <strong
                    style={{
                      color: "#173153",
                      fontSize: "0.96rem",
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {activeVideo.title}
                  </strong>
                  <span
                    style={{
                      color: "#667c93",
                      fontSize: "0.78rem",
                      lineHeight: 1.2,
                    }}
                  >
                    youtube.com
                  </span>
                </div>
                <FrontOfficeTrackedLink
                  className="office-button-secondary office-button-sm"
                  href={activeVideo.href}
                  tracking={{
                    type: "resource_open",
                    resourceId: activeVideo.id,
                  }}
                >
                  Open on YouTube
                </FrontOfficeTrackedLink>
                <button
                  className="office-button office-button-sm"
                  onClick={() => setActiveVideo(null)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div style={iframeWrapStyle}>
              {embedHref ? (
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={embedHref}
                  style={iframeStyle}
                  title={activeVideo.title}
                />
              ) : (
                <div style={placeholderStyle}>
                  <div
                    style={{
                      display: "grid",
                      gap: "0.75rem",
                      justifyItems: "center",
                      textAlign: "center",
                      padding: "2rem",
                    }}
                  >
                    <strong style={{ fontSize: "1.15rem" }}>
                      Unable to embed this video.
                    </strong>
                    <FrontOfficeTrackedLink
                      className="office-button"
                      href={activeVideo.href}
                      tracking={{
                        type: "resource_open",
                        resourceId: activeVideo.id,
                      }}
                    >
                      Open on YouTube
                    </FrontOfficeTrackedLink>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
