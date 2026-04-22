"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { StudioListingDetailSnapshot } from "@acre/db";
import { useRouter } from "next/navigation";
import {
  appendListingStudioPosterDraftSearchParams,
  buildListingStudioPosterDraft,
  buildListingStudioPosterHref,
  buildListingStudioPosterFileName,
  getListingStudioPosterInteractiveSlots,
  getListingStudioPosterPrimarySlotId,
  getListingStudioPosterResolvedSlotAssetIds,
  getListingStudioPosterStatusVariants,
  getListingStudioPosterTemplates,
  type ListingStudioPosterDraft,
  type ListingStudioPosterImageSlotId,
  type ListingStudioPosterStatusVariantId,
  type ListingStudioPosterTemplateId,
} from "../listing-studio-poster";

type ListingStudioShareStudioClientProps = {
  detail: StudioListingDetailSnapshot;
  initialDraft: ListingStudioPosterDraft;
};

function IconArrowLeft() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m14 6-6 6 6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m6 12 4 4 8-8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconPrinter() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M8 7V4h8v3M8 17h8v3H8v-3Zm-2-8h12a3 3 0 0 1 3 3v3h-4v-2H7v2H3v-3a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function buildPosterStudioQueryString(draft: ListingStudioPosterDraft) {
  return appendListingStudioPosterDraftSearchParams(
    new URLSearchParams(),
    draft,
  ).toString();
}

function parseContentDispositionFileName(value: string | null) {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = value.match(/filename="([^"]+)"/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return null;
}

function buildSafeLocalFileName(
  detail: StudioListingDetailSnapshot,
  draft: ListingStudioPosterDraft,
) {
  return buildListingStudioPosterFileName(detail, draft, "png");
}

function openExternalWindow(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ListingStudioShareStudioClient({
  detail,
  initialDraft,
}: ListingStudioShareStudioClientProps) {
  const router = useRouter();
  const [detailState, setDetailState] = useState(detail);
  const [draft, setDraft] = useState(initialDraft);
  const [selectedSlotId, setSelectedSlotId] =
    useState<ListingStudioPosterImageSlotId | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);
  const [isOpeningHtml, setIsOpeningHtml] = useState(false);
  const shareCode = detailState.pack.shareCode?.trim() || null;
  const queryString = useMemo(
    () => buildPosterStudioQueryString(draft),
    [draft],
  );
  const previewStamp = shareCode ?? "pending";
  const previewHref = useMemo(() => {
    const url = new URLSearchParams();
    url.set("previewKey", previewStamp);
    return `${buildListingStudioPosterHref({
      draft,
      format: "svg",
      packId: detailState.packId,
    })}&${url.toString()}`;
  }, [detailState.packId, draft, previewStamp]);
  const htmlPreviewHref = useMemo(() => {
    return `${buildListingStudioPosterHref({
      draft,
      format: "html",
      packId: detailState.packId,
      print: true,
    })}&previewKey=${previewStamp}`;
  }, [detailState.packId, draft, previewStamp]);
  const templates = useMemo(() => getListingStudioPosterTemplates(), []);
  const statusVariants = useMemo(
    () => getListingStudioPosterStatusVariants(),
    [],
  );
  const interactiveSlots = useMemo(
    () => getListingStudioPosterInteractiveSlots(draft.templateId),
    [draft.templateId],
  );
  const primarySlotId = useMemo(
    () => getListingStudioPosterPrimarySlotId(draft.templateId),
    [draft.templateId],
  );
  const photoAssets = useMemo(
    () =>
      detailState.assets.filter((asset) => {
        const isPhotoKind = asset.kind === "hero" || asset.kind === "gallery";
        const isVideoMime =
          typeof asset.mimeType === "string" &&
          asset.mimeType.toLowerCase().startsWith("video/");

        return isPhotoKind && !isVideoMime;
      }),
    [detailState.assets],
  );
  const resolvedSlotAssetIds = useMemo(
    () => getListingStudioPosterResolvedSlotAssetIds(detailState, draft),
    [detailState, draft],
  );
  const activePhotoAssetId = selectedSlotId
    ? resolvedSlotAssetIds[selectedSlotId] ?? null
    : resolvedSlotAssetIds[primarySlotId] ?? draft.coverAssetId;
  const templatePreviewMap = useMemo(() => {
    return templates.reduce<Record<string, string>>((accumulator, template) => {
      const previewDraft = buildListingStudioPosterDraft(
        detailState,
        template.id,
        draft.coverAssetId,
        draft.statusVariant,
        draft.slotAssetIds,
      );
      accumulator[template.id] = `${buildListingStudioPosterHref({
        draft: previewDraft,
        format: "svg",
        packId: detailState.packId,
      })}&previewKey=${previewStamp}&thumb=${template.id}`;
      return accumulator;
    }, {});
  }, [
    detailState,
    draft.coverAssetId,
    draft.slotAssetIds,
    draft.statusVariant,
    previewStamp,
    templates,
  ]);

  useEffect(() => {
    if (
      selectedSlotId &&
      !interactiveSlots.some((slot) => slot.id === selectedSlotId)
    ) {
      setSelectedSlotId(null);
    }
  }, [interactiveSlots, selectedSlotId]);

  useEffect(() => {
    const nextHref = `/listing-studio/listings/${detailState.packId}/share?${queryString}`;

    startTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  }, [detailState.packId, queryString, router]);

  useEffect(() => {
    if (!statusMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setStatusMessage(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  function updateTemplate(templateId: ListingStudioPosterTemplateId) {
    setDraft((current) => ({
      ...current,
      templateId,
    }));
  }

  function updateStatus(statusVariant: ListingStudioPosterStatusVariantId) {
    setDraft((current) => ({
      ...current,
      statusVariant,
    }));
  }

  function toggleSelectedSlot(slotId: ListingStudioPosterImageSlotId) {
    setSelectedSlotId((current) => (current === slotId ? null : slotId));
  }

  function replaceSelectedSlotAsset(slotId: ListingStudioPosterImageSlotId, assetId: string) {
    setDraft((current) => ({
      ...current,
      slotAssetIds: {
        ...current.slotAssetIds,
        [slotId]: assetId,
      },
    }));
  }

  function applyPhotoAsset(assetId: string) {
    replaceSelectedSlotAsset(selectedSlotId ?? primarySlotId, assetId);
  }

  async function ensureSharePublished() {
    if (shareCode) {
      return shareCode;
    }

    setIsPreparingShare(true);
    setStatusMessage("");

    try {
      const response = await fetch(
        `/api/listing-studio/listings/${detailState.packId}/share`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Unable to publish the share page.");
      }

      const body = (await response.json()) as {
        shareCode: string;
      };

      setDetailState((current) => ({
        ...current,
        pack: {
          ...current.pack,
          shareCode: body.shareCode,
          shareEnabled: true,
        },
      }));

      return body.shareCode;
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to publish the share page.",
      );
      return null;
    } finally {
      setIsPreparingShare(false);
    }
  }

  async function downloadPng() {
    setIsDownloadingPng(true);
    setStatusMessage("");

    try {
      const url = new URL(
        `${window.location.origin}${buildListingStudioPosterHref({
          draft,
          download: true,
          format: "png",
          packId: detailState.packId,
        })}&previewKey=${previewStamp}`,
      );

      const response = await fetch(url.toString(), {
        method: "GET",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Unable to download the PNG.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download =
        parseContentDispositionFileName(
          response.headers.get("content-disposition"),
        ) ?? buildSafeLocalFileName(detailState, draft);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to download the PNG.",
      );
    } finally {
      setIsDownloadingPng(false);
    }
  }

  async function openLiveShare() {
    const nextShareCode = shareCode ?? (await ensureSharePublished());

    if (!nextShareCode) {
      return;
    }

    openExternalWindow(`${window.location.origin}/share/packs/${nextShareCode}`);
  }

  function openPrintPreview() {
    setIsOpeningHtml(true);
    openExternalWindow(htmlPreviewHref);
    window.setTimeout(() => setIsOpeningHtml(false), 600);
  }

  return (
    <div className="listing-studio-listed-shell listing-studio-share-studio-shell">
      <div className="listing-studio-listed-frame listing-studio-share-studio-frame">
        <div className="listing-studio-share-studio-layout">
          <aside className="listing-studio-share-studio-templates">
            <div className="listing-studio-share-studio-panel">
              <div className="listing-studio-share-studio-template-list">
                {templates.map((template) => {
                  const isActive = draft.templateId === template.id;

                  return (
                    <button
                      className={`listing-studio-share-studio-template-card${isActive ? " is-active" : ""}`}
                      key={template.id}
                      onClick={() => updateTemplate(template.id)}
                      type="button"
                    >
                      <div className="listing-studio-share-studio-template-image">
                        <img
                          alt={`${template.label} template preview`}
                          loading="lazy"
                          src={templatePreviewMap[template.id]}
                        />
                        {isActive ? (
                          <span className="listing-studio-share-studio-template-check">
                            <IconCheck />
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="listing-studio-share-studio-preview">
            <div className="listing-studio-share-studio-preview-panel">
              <div className="listing-studio-share-studio-preview-canvas">
                <div className="listing-studio-share-studio-preview-stage">
                  <img
                    alt={`${detailState.addressLine} ${draft.templateId} poster preview`}
                    className="listing-studio-share-studio-preview-image"
                    src={previewHref}
                  />
                  {interactiveSlots.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;

                    return (
                      <button
                        aria-label={`Select ${slot.label}`}
                        className={`listing-studio-share-studio-preview-slot${isSelected ? " is-selected" : ""}`}
                        key={slot.id}
                        onClick={() => toggleSelectedSlot(slot.id)}
                        style={{
                          height: `${(slot.height / 2880) * 100}%`,
                          left: `${(slot.x / 2160) * 100}%`,
                          top: `${(slot.y / 2880) * 100}%`,
                          width: `${(slot.width / 2160) * 100}%`,
                        }}
                        title={slot.label}
                        type="button"
                      >
                        <span className="listing-studio-share-studio-preview-slot-label">
                          {slot.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="listing-studio-share-studio-preview-actions">
                <button
                  className="listing-studio-share-studio-download"
                  disabled={isDownloadingPng}
                  onClick={() => void downloadPng()}
                  type="button"
                >
                  <IconDownload />
                  <span>{isDownloadingPng ? "Preparing PNG..." : "Download PNG"}</span>
                </button>
              </div>
            </div>
          </section>

          <aside className="listing-studio-share-studio-controls">
            <div className="listing-studio-share-studio-panel">
              <Link
                className="listing-studio-share-studio-back"
                href={`/listing-studio/listings/${detailState.packId}`}
              >
                <IconArrowLeft />
                <span>Back to listing</span>
              </Link>

              <div className="listing-studio-share-studio-panel-head">
                <strong>Poster studio</strong>
                <p>
                  Match the layout, update the listing status, then export a
                  vertical PNG.
                </p>
              </div>

              <div className="listing-studio-share-studio-section">
                <div className="listing-studio-share-studio-section-head">
                  <strong>Listing status</strong>
                </div>
                <div className="listing-studio-share-studio-status-grid">
                  {statusVariants.map((statusVariant) => {
                    const isActive = draft.statusVariant === statusVariant.id;

                    return (
                      <button
                        className={`listing-studio-share-studio-status-pill${isActive ? " is-active" : ""}`}
                        key={statusVariant.id}
                        onClick={() => updateStatus(statusVariant.id)}
                        type="button"
                      >
                        {statusVariant.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="listing-studio-share-studio-section">
                <div className="listing-studio-share-studio-section-head">
                  <strong>Photos</strong>
                </div>
                <div className="listing-studio-share-studio-photo-grid">
                  {photoAssets.map((asset) => {
                    const isActive = activePhotoAssetId === asset.id;

                    return (
                      <button
                        className={`listing-studio-share-studio-photo-card${isActive ? " is-active" : ""}`}
                        key={asset.id}
                        onClick={() => applyPhotoAsset(asset.id)}
                        type="button"
                      >
                        <img
                          alt={asset.label ?? detailState.title}
                          loading="lazy"
                          src={`/api/listing-studio/assets/${asset.id}`}
                        />
                        {isActive ? (
                          <span className="listing-studio-share-studio-photo-check">
                            <IconCheck />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="listing-studio-share-studio-section">
                <div className="listing-studio-share-studio-section-head">
                  <strong>Export</strong>
                </div>
                <div className="listing-studio-share-studio-action-stack">
                  <button
                    className="office-button"
                    disabled={isPreparingShare}
                    onClick={() => void openLiveShare()}
                    type="button"
                  >
                    <IconExternalLink />
                    <span>Open live share</span>
                  </button>
                  <button
                    className="office-button-secondary"
                    disabled={isOpeningHtml}
                    onClick={openPrintPreview}
                    type="button"
                  >
                    <IconPrinter />
                    <span>{isOpeningHtml ? "Opening..." : "Print preview"}</span>
                  </button>
                </div>
              </div>

              {statusMessage ? (
                <p className="listing-studio-share-studio-feedback">
                  {statusMessage}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
