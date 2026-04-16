"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { FrontOfficeResourceRecord } from "@acre/db";
import { FrontOfficeTrackedLink } from "../_components/front-office-tracked-link";

const interactionEndpoint = "/api/resources/interactions";

const galleryShellStyle: CSSProperties = {
  display: "grid",
  gap: "1.35rem",
};

const galleryGridStyle: CSSProperties = {
  display: "grid",
  gap: "1.25rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const cardButtonStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: 0,
  border: "none",
  background: "transparent",
  textAlign: "left",
  cursor: "pointer",
};

const coverFrameStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 0,
  border: "1px solid rgba(18, 53, 104, 0.1)",
  background:
    "linear-gradient(180deg, rgba(238, 243, 250, 0.96) 0%, rgba(226, 234, 244, 0.98) 100%)",
  boxShadow: "0 18px 30px rgba(18, 53, 104, 0.08)",
  aspectRatio: "16 / 9",
};

const coverImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const fallbackCoverStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: "1.5rem",
  color: "#173153",
  fontSize: "1.05rem",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  textAlign: "center",
};

const cardMetaStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  padding: "0 0.15rem",
};

const cardTitleStyle: CSSProperties = {
  color: "#173153",
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1.35,
  letterSpacing: "-0.02em",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardDetailStyle: CSSProperties = {
  color: "#667c93",
  fontSize: "0.83rem",
  lineHeight: 1.45,
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(8, 17, 32, 0.68)",
  backdropFilter: "blur(14px)",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  padding: "0.85rem",
};

const shellStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto 1fr",
  width: "min(1600px, 100%)",
  minHeight: "100%",
  borderRadius: "28px",
  overflow: "hidden",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  background:
    "linear-gradient(180deg, rgba(244, 248, 252, 0.98) 0%, rgba(233, 239, 247, 0.98) 100%)",
  boxShadow: "0 32px 80px rgba(8, 17, 32, 0.34)",
};

const chromeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "0.9rem 1rem",
  borderBottom: "1px solid rgba(18, 53, 104, 0.1)",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 249, 253, 0.92) 100%)",
};

const chromeDotsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  flexShrink: 0,
};

const dotStyle = (color: string): CSSProperties => ({
  width: "0.72rem",
  height: "0.72rem",
  borderRadius: "999px",
  background: color,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
});

const addressBarStyle: CSSProperties = {
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

const iframeWrapStyle: CSSProperties = {
  position: "relative",
  minHeight: 0,
  background: "#050b16",
};

const iframeStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  border: 0,
  display: "block",
};

const placeholderStyle: CSSProperties = {
  position: "absolute",
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

function buildThumbnailHref(value: string) {
  const videoId = getYouTubeVideoId(value);

  if (!videoId) {
    return null;
  }

  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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

function TrainingCard(props: {
  resource: FrontOfficeResourceRecord;
  onPlay: (video: VideoPlayerState) => void;
}) {
  const { resource, onPlay } = props;
  const thumbnailHref = buildThumbnailHref(resource.href);

  return (
    <button
      onClick={() =>
        onPlay({
          id: resource.id,
          title: resource.title,
          href: resource.href,
        })
      }
      style={cardButtonStyle}
      type="button"
    >
      <div style={coverFrameStyle}>
        {thumbnailHref ? (
          <img
            alt={resource.title}
            loading="lazy"
            src={thumbnailHref}
            style={coverImageStyle}
          />
        ) : (
          <div style={fallbackCoverStyle}>Video cover</div>
        )}
      </div>
      <div style={cardMetaStyle}>
        <strong style={cardTitleStyle}>{resource.title}</strong>
        <span style={cardDetailStyle}>
          {resource.detailLabel} · {resource.freshnessLabel}
        </span>
      </div>
    </button>
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
      <div style={galleryShellStyle}>
        <div style={galleryGridStyle}>
          {props.resources.map((resource) => (
            <TrainingCard
              key={resource.id}
              onPlay={handlePlay}
              resource={resource}
            />
          ))}
        </div>
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
