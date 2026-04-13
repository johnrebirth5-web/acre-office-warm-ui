"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioListingDetailSnapshot } from "@acre/db";
import { Button, ConfirmActionDialog, SectionCard, TextareaInput, TextInput } from "@acre/ui";
import {
  buildListingStudioMarketingKit,
  buildListingStudioPosterCopyText,
  buildListingStudioPosterDraft,
  buildListingStudioPosterHref,
  buildListingStudioPosterScanTarget,
  getListingStudioPosterTemplates,
  type ListingStudioPosterTemplateId,
} from "./listing-studio-poster";

type ListingStudioDetailClientProps = {
  detail: StudioListingDetailSnapshot;
};

function buildShareUrl(shareCode: string | null) {
  return shareCode ? `/share/packs/${shareCode}` : null;
}

function normalizeBulletPointsInput(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildPosterUrl(input: {
  packId: string;
  templateId: ListingStudioPosterTemplateId;
  kicker: string;
  headline: string;
  subheadline: string;
  cta: string;
  footer: string;
  coverAssetId: string | null;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  download?: boolean;
  print?: boolean;
}) {
  return buildListingStudioPosterHref({
    packId: input.packId,
    draft: {
      templateId: input.templateId,
      kicker: input.kicker,
      headline: input.headline,
      subheadline: input.subheadline,
      cta: input.cta,
      footer: input.footer,
      coverAssetId: input.coverAssetId,
    },
    contactName: input.contactName,
    contactTitle: input.contactTitle,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail,
    download: input.download,
    print: input.print,
  });
}

export function ListingStudioDetailClient({
  detail,
}: ListingStudioDetailClientProps) {
  const router = useRouter();
  const [headline, setHeadline] = useState(detail.pack.headline);
  const [summary, setSummary] = useState(detail.pack.summary);
  const [agentNote, setAgentNote] = useState(detail.pack.agentNote);
  const [bulletText, setBulletText] = useState(detail.pack.bulletPoints.join("\n"));
  const [contactName, setContactName] = useState(detail.pack.contactName);
  const [contactTitle, setContactTitle] = useState(detail.pack.contactTitle);
  const [contactPhone, setContactPhone] = useState(detail.pack.contactPhone);
  const [contactEmail, setContactEmail] = useState(detail.pack.contactEmail);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    detail.pack.selectedAssetIds,
  );
  const [coverAssetId, setCoverAssetId] = useState<string | null>(
    detail.pack.coverAssetId ?? detail.assets[0]?.id ?? null,
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [shareCode, setShareCode] = useState(detail.pack.shareCode);
  const [shareEnabled, setShareEnabled] = useState(detail.pack.shareEnabled);
  const initialPosterDraft = buildListingStudioPosterDraft(
    detail,
    "editorial",
    detail.pack.coverAssetId ?? detail.assets[0]?.id ?? null,
  );
  const [posterTemplateId, setPosterTemplateId] = useState<
    ListingStudioPosterTemplateId
  >(initialPosterDraft.templateId);
  const [posterKicker, setPosterKicker] = useState(initialPosterDraft.kicker);
  const [posterHeadline, setPosterHeadline] = useState(
    initialPosterDraft.headline,
  );
  const [posterSubheadline, setPosterSubheadline] = useState(
    initialPosterDraft.subheadline,
  );
  const [posterCta, setPosterCta] = useState(initialPosterDraft.cta);
  const [posterFooter, setPosterFooter] = useState(initialPosterDraft.footer);
  const [posterCoverAssetId, setPosterCoverAssetId] = useState<string | null>(
    initialPosterDraft.coverAssetId,
  );

  const normalizedBulletPoints = useMemo(
    () => normalizeBulletPointsInput(bulletText),
    [bulletText],
  );
  const heroAssetId =
    coverAssetId ?? selectedAssetIds[0] ?? detail.assets[0]?.id ?? null;
  const shareUrl = buildShareUrl(shareCode);
  const posterTemplates = getListingStudioPosterTemplates();
  const packetPreviewDetail = useMemo(
    () => ({
      ...detail,
      pack: {
        ...detail.pack,
        headline,
        summary,
        bulletPoints: normalizedBulletPoints,
        selectedAssetIds,
        coverAssetId,
        agentNote,
        shareEnabled,
        shareCode,
        contactName,
        contactTitle,
        contactPhone,
        contactEmail,
      },
    }),
    [
      agentNote,
      contactEmail,
      contactName,
      contactPhone,
      contactTitle,
      coverAssetId,
      detail,
      headline,
      normalizedBulletPoints,
      selectedAssetIds,
      shareCode,
      shareEnabled,
      summary,
    ],
  );
  const posterDraft = useMemo(
    () => ({
      templateId: posterTemplateId,
      kicker: posterKicker,
      headline: posterHeadline,
      subheadline: posterSubheadline,
      cta: posterCta,
      footer: posterFooter,
      coverAssetId: posterCoverAssetId,
    }),
    [
      posterCta,
      posterCoverAssetId,
      posterFooter,
      posterHeadline,
      posterKicker,
      posterSubheadline,
      posterTemplateId,
    ],
  );
  const posterPreviewUrl = useMemo(
    () =>
      buildPosterUrl({
        packId: detail.packId,
        templateId: posterTemplateId,
        kicker: posterKicker,
        headline: posterHeadline,
        subheadline: posterSubheadline,
        cta: posterCta,
        footer: posterFooter,
        coverAssetId: posterCoverAssetId,
        contactName,
        contactTitle,
        contactPhone,
        contactEmail,
      }),
    [
      contactEmail,
      contactName,
      contactPhone,
      contactTitle,
      detail.packId,
      posterCta,
      posterCoverAssetId,
      posterFooter,
      posterHeadline,
      posterKicker,
      posterSubheadline,
      posterTemplateId,
    ],
  );
  const posterPrintUrl = useMemo(
    () =>
      buildPosterUrl({
        packId: detail.packId,
        templateId: posterTemplateId,
        kicker: posterKicker,
        headline: posterHeadline,
        subheadline: posterSubheadline,
        cta: posterCta,
        footer: posterFooter,
        coverAssetId: posterCoverAssetId,
        print: true,
        contactName,
        contactTitle,
        contactPhone,
        contactEmail,
      }),
    [
      contactEmail,
      contactName,
      contactPhone,
      contactTitle,
      detail.packId,
      posterCta,
      posterCoverAssetId,
      posterFooter,
      posterHeadline,
      posterKicker,
      posterSubheadline,
      posterTemplateId,
    ],
  );
  const posterDownloadUrl = useMemo(
    () =>
      buildPosterUrl({
        packId: detail.packId,
        templateId: posterTemplateId,
        kicker: posterKicker,
        headline: posterHeadline,
        subheadline: posterSubheadline,
        cta: posterCta,
        footer: posterFooter,
        coverAssetId: posterCoverAssetId,
        download: true,
        contactName,
        contactTitle,
        contactPhone,
        contactEmail,
      }),
    [
      contactEmail,
      contactName,
      contactPhone,
      contactTitle,
      detail.packId,
      posterCta,
      posterCoverAssetId,
      posterFooter,
      posterHeadline,
      posterKicker,
      posterSubheadline,
      posterTemplateId,
    ],
  );
  const posterCopyText = useMemo(
    () =>
      buildListingStudioPosterCopyText(
        packetPreviewDetail,
        posterDraft,
      ),
    [packetPreviewDetail, posterDraft],
  );
  const marketingKit = useMemo(
    () => buildListingStudioMarketingKit(packetPreviewDetail, posterDraft),
    [packetPreviewDetail, posterDraft],
  );
  const posterPacketTarget = buildListingStudioPosterScanTarget(packetPreviewDetail);
  const scanTargetHref = posterPacketTarget.href;
  const scanTargetLabel = posterPacketTarget.label;
  const scanTargetHint = posterPacketTarget.hint;
  const activePosterTemplate =
    posterTemplates.find((template) => template.id === posterTemplateId) ??
    posterTemplates[0];
  const activeGallery = useMemo(
    () =>
      detail.assets.filter(
        (asset) =>
          selectedAssetIds.includes(asset.id) || asset.id === heroAssetId,
      ),
    [detail.assets, heroAssetId, selectedAssetIds],
  );

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) => {
      if (current.includes(assetId)) {
        const next = current.filter((value) => value !== assetId);
        if (!next.length) {
          return current;
        }
        if (coverAssetId === assetId) {
          setCoverAssetId(next[0] ?? null);
        }
        return next;
      }

      return [...current, assetId];
    });
  }

  function savePack() {
    setIsSaving(true);
    setStatusMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/listing-studio/listings/${detail.packId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            headline,
            summary,
            bulletPoints: normalizedBulletPoints,
            selectedAssetIds,
            coverAssetId,
            agentNote,
            contactName,
            contactTitle,
            contactPhone,
            contactEmail,
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Unable to save the packet.");
        }

        setStatusMessage("Packet changes saved.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to save the packet.");
      } finally {
        setIsSaving(false);
      }
    });
  }

  function publishShare() {
    setIsSharing(true);
    setStatusMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/listing-studio/listings/${detail.packId}/share`, {
          method: "POST",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Unable to publish the share link.");
        }

        const body = (await response.json()) as { shareCode: string; shareUrl: string };
        setShareCode(body.shareCode);
        setShareEnabled(true);
        setStatusMessage("Public share link is ready.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to publish the share link.");
      } finally {
        setIsSharing(false);
      }
    });
  }

  async function copyShareUrl() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(window.location.origin + shareUrl);
    setStatusMessage("Share URL copied.");
  }

  async function copyPosterCopy() {
    try {
      await navigator.clipboard.writeText(posterCopyText);
      setStatusMessage("Poster copy copied.");
    } catch {
      setStatusMessage("Clipboard access is not available for poster copy.");
    }
  }

  async function copyMarketingKitCopy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage(`${label} copied.`);
    } catch {
      setStatusMessage(`Clipboard access is not available for ${label.toLowerCase()}.`);
    }
  }

  async function copyScanLink() {
    try {
      const absoluteUrl = scanTargetHref.startsWith("http")
        ? scanTargetHref
        : `${window.location.origin}${scanTargetHref.startsWith("/") ? scanTargetHref : `/${scanTargetHref}`}`;
      await navigator.clipboard.writeText(absoluteUrl);
      setStatusMessage("Scan link copied.");
    } catch {
      setStatusMessage("Unable to copy the scan link in this browser.");
    }
  }

  async function copyPosterHtml() {
    try {
      const response = await fetch(posterPreviewUrl, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Unable to load the poster preview.");
      }

      await navigator.clipboard.writeText(await response.text());
      setStatusMessage("Poster HTML copied.");
    } catch {
      setStatusMessage("Unable to copy poster HTML in this browser.");
    }
  }

  function deleteListing() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setStatusMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/listing-studio/listings/${detail.packId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Unable to delete the listing.");
        }

        router.push("/listing-studio/listings?deleted=1");
        router.refresh();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to delete the listing.");
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
      }
    });
  }

  return (
    <>
      <div className="listing-studio-detail-layout">
        <div className="listing-studio-detail-main">
        <SectionCard
          className="listing-studio-hero-card"
          subtitle={detail.locationLine ?? "Imported listing packet"}
          title={detail.title}
        >
          <div className="listing-studio-hero-stack">
            <div className="listing-studio-hero-media">
              {heroAssetId ? (
                <img
                  alt={detail.title}
                  src={`/api/listing-studio/assets/${heroAssetId}`}
                />
              ) : (
                <div className="listing-studio-card-media-fallback">
                  {detail.sourceSite}
                </div>
              )}
            </div>
            <div className="listing-studio-hero-strip">
              <strong>{detail.priceLabel}</strong>
              <span>{detail.addressLine}</span>
              <span>{detail.listingType ?? detail.statusLabel ?? "Listing packet"}</span>
            </div>
            {activeGallery.length ? (
              <div className="listing-studio-thumbnail-row">
                {activeGallery.map((asset) => (
                  <button
                    className={`listing-studio-thumbnail${asset.id === heroAssetId ? " is-active" : ""}`}
                    key={asset.id}
                    onClick={() => setCoverAssetId(asset.id)}
                    type="button"
                  >
                    <img
                      alt={asset.label ?? detail.title}
                      src={`/api/listing-studio/assets/${asset.id}`}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle="The normalized facts layer stays read-only. Editing happens on the customer-facing packet in the right rail."
          title="Facts"
        >
          <div className="listing-studio-facts-grid">
            {detail.facts.map((fact) => (
              <div className="listing-studio-fact-card" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
          {detail.descriptionText ? (
            <p className="listing-studio-description">{detail.descriptionText}</p>
          ) : null}
        </SectionCard>

        {detail.sourceFacts.length ? (
          <SectionCard
            className="office-list-card"
            subtitle="Structured source facts captured from the original listing page."
            title="Source facts"
          >
            <div className="listing-studio-keyvalue-grid">
              {detail.sourceFacts.map((item) => (
                <div className="listing-studio-keyvalue-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        <div className="listing-studio-section-grid">
          <SectionCard
            className="office-list-card"
            subtitle="Grouped directly from the imported listing payload."
            title="Amenities"
          >
            {detail.amenities.length ? (
              <div className="listing-studio-pill-section">
                {detail.amenities.map((section) => (
                  <div className="listing-studio-pill-group" key={section.title}>
                    <strong>{section.title}</strong>
                    <div className="listing-studio-pill-row">
                      {section.items.map((item) => (
                        <span className="listing-studio-pill" key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="listing-studio-muted">No amenities were captured.</p>
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Nearby transit parsed from the source page when available."
            title="Transit"
          >
            {detail.transit.length ? (
              <div className="listing-studio-transit-list">
                {detail.transit.map((item) => (
                  <div className="listing-studio-transit-item" key={`${item.label}-${item.distanceLabel ?? ""}`}>
                    <strong>{item.label}</strong>
                    <span>{item.detail ?? "Transit access captured"}</span>
                    {item.distanceLabel ? <em>{item.distanceLabel}</em> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="listing-studio-muted">No transit details were captured.</p>
            )}
          </SectionCard>
        </div>

        {detail.propertyHistory.length ? (
          <SectionCard
            className="office-list-card"
            subtitle="Property and listing history blocks captured from the source page."
            title="History"
          >
            <div className="listing-studio-detail-section-list">
              {detail.propertyHistory.map((section) => (
                <div className="listing-studio-detail-section-block" key={section.title}>
                  <strong>{section.title}</strong>
                  <div className="listing-studio-detail-section-items">
                    {section.items.map((item) => (
                      <span key={`${section.title}-${item}`}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {detail.capturedSections.length ? (
          <SectionCard
            className="office-list-card"
            subtitle="Additional sections captured from the listing page that do not fit the core fact cards."
            title="Additional details"
          >
            <div className="listing-studio-detail-section-list">
              {detail.capturedSections.map((section) => (
                <div className="listing-studio-detail-section-block" key={section.title}>
                  <strong>{section.title}</strong>
                  <div className="listing-studio-detail-section-items">
                    {section.items.map((item) => (
                      <span key={`${section.title}-${item}`}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          className="office-list-card"
          subtitle="Select the images that should stay in the public packet and choose the hero image."
          title="Media selection"
        >
          <div className="listing-studio-media-selector-grid">
            {detail.assets.map((asset) => {
              const isSelected = selectedAssetIds.includes(asset.id);
              const isCover = asset.id === coverAssetId;

              return (
                <div className="listing-studio-media-selector-card" key={asset.id}>
                  <img
                    alt={asset.label ?? detail.title}
                    src={`/api/listing-studio/assets/${asset.id}`}
                  />
                  <div className="listing-studio-media-selector-body">
                    <div className="listing-studio-card-meta">
                      <span className="office-status-badge office-status-badge-neutral">
                        {asset.kind}
                      </span>
                      {isCover ? (
                        <span className="office-status-badge office-status-badge-success">
                          Cover
                        </span>
                      ) : null}
                    </div>
                    <strong>{asset.label ?? "Imported asset"}</strong>
                    <div className="listing-studio-media-selector-actions">
                      <Button
                        onClick={() => toggleAsset(asset.id)}
                        variant={isSelected ? "primary" : "secondary"}
                      >
                        {isSelected ? "Included" : "Include"}
                      </Button>
                      <Button
                        disabled={!isSelected}
                        onClick={() => setCoverAssetId(asset.id)}
                        variant="ghost"
                      >
                        Set hero
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

        <div className="listing-studio-detail-rail">
          <SectionCard
            className="office-list-card"
            subtitle="Generate a print-ready HTML poster from the imported packet. The output stays local to Acre and now keeps the agent info and scan path visible in both the preview and the exported HTML."
            title="Poster generator"
          >
            <div className="listing-studio-editor-form">
              <div className="listing-studio-card-meta">
                <span className="office-status-badge office-status-badge-neutral">
                  {activePosterTemplate.label}
                </span>
                <span className="office-status-badge office-status-badge-success">
                  HTML/CSS
                </span>
              </div>
              <p className="listing-studio-muted">{activePosterTemplate.description}</p>
              <div className="listing-studio-filter-actions">
                {posterTemplates.map((template) => (
                  <Button
                    key={template.id}
                    onClick={() => {
                      const nextDraft = buildListingStudioPosterDraft(
                        packetPreviewDetail,
                        template.id,
                        posterCoverAssetId,
                      );
                      setPosterTemplateId(template.id);
                      setPosterKicker(nextDraft.kicker);
                      setPosterHeadline(nextDraft.headline);
                      setPosterSubheadline(nextDraft.subheadline);
                      setPosterCta(nextDraft.cta);
                      setPosterFooter(nextDraft.footer);
                    }}
                    variant={posterTemplateId === template.id ? "primary" : "secondary"}
                  >
                    {template.label}
                  </Button>
                ))}
              </div>

              <label className="listing-studio-filter-field">
                <span>Kicker</span>
                <TextInput value={posterKicker} onChange={(event) => setPosterKicker(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field">
                <span>Headline</span>
                <TextInput value={posterHeadline} onChange={(event) => setPosterHeadline(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field">
                <span>Subheadline</span>
                <TextareaInput
                  rows={3}
                  value={posterSubheadline}
                  onChange={(event) => setPosterSubheadline(event.target.value)}
                />
              </label>
              <label className="listing-studio-filter-field">
                <span>CTA</span>
                <TextInput value={posterCta} onChange={(event) => setPosterCta(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field">
                <span>Footer</span>
                <TextInput value={posterFooter} onChange={(event) => setPosterFooter(event.target.value)} />
              </label>
              <div className="listing-studio-filter-field">
                <span>Hero image</span>
                <div className="listing-studio-filter-actions">
                  {detail.assets.slice(0, 4).map((asset) => (
                    <Button
                      key={asset.id}
                      onClick={() => setPosterCoverAssetId(asset.id)}
                      variant={posterCoverAssetId === asset.id ? "primary" : "secondary"}
                    >
                      {asset.label ?? asset.kind}
                    </Button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  border: "1px solid rgba(16, 32, 51, 0.12)",
                  borderRadius: "20px",
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <iframe
                  key={posterPreviewUrl}
                  src={posterPreviewUrl}
                  title="Listing Studio poster preview"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "540px",
                    border: 0,
                    background: "#fff",
                  }}
                />
              </div>
              <div className="listing-studio-editor-actions">
                <a
                  className="office-button office-button-secondary"
                  href={posterPrintUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open print view
                </a>
                <a
                  className="office-button office-button-secondary"
                  download
                  href={posterDownloadUrl}
                >
                  Download HTML
                </a>
                <Button onClick={() => void copyPosterHtml()} variant="ghost">
                  Copy HTML
                </Button>
                <Button onClick={() => void copyPosterCopy()} variant="ghost">
                  Copy poster copy
                </Button>
              </div>
              <div className="listing-studio-keyvalue-grid">
                <div className="listing-studio-keyvalue-card">
                  <span>Agent info</span>
                  <strong>{contactName || "Acre listing studio"}</strong>
                  <span>{contactTitle || "Listing presentation"}</span>
                  <strong>{contactPhone || "Phone not published"}</strong>
                  <span>{contactEmail || "Email not published"}</span>
                </div>
                <div className="listing-studio-keyvalue-card">
                  <span>Scan path</span>
                  <strong>{scanTargetLabel}</strong>
                  <span>{scanTargetHint}</span>
                  <strong>{scanTargetHref}</strong>
                </div>
              </div>
              <div className="listing-studio-editor-actions">
                <Button onClick={() => void copyScanLink()} variant="secondary">
                  Copy scan link
                </Button>
                <a
                  className="office-button office-button-secondary"
                  href={scanTargetHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open scan path
                </a>
              </div>
              <p className="listing-studio-muted">
                Preview changes stay manual and reviewable. The poster never auto-sends or syncs to an external template service.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="One saved packet feeds the poster, PDF export, and share page. The current contact block stays visible across every reviewable output."
            title="Packet distribution"
          >
            <div className="listing-studio-keyvalue-grid">
              <div className="listing-studio-keyvalue-card">
                <span>Live packet</span>
                <strong>{shareEnabled && shareUrl ? "Published share page" : "Source listing fallback"}</strong>
                <span>
                  {shareEnabled && shareUrl
                    ? `Packet link: ${shareUrl}`
                    : "Publish the share link to route scan paths away from the source listing."}
                </span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Poster outputs</span>
                <strong>Preview, print, HTML download</strong>
                <span>
                  All three outputs reuse the same manual packet copy, hero asset, and agent contact block.
                </span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>PDF export</span>
                <strong>Saved packet snapshot</strong>
                <span>
                  The PDF follows the latest saved contact details, selected assets, and packet summary.
                </span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Review mode</span>
                <strong>Manual and review-first</strong>
                <span>
                  No external template sync, PNG render, or auto-send is implied by this packet summary.
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Copy-ready captions, blurbs, and follow-up notes generated from the saved packet. The kit stays manual, review-first, and Acre-owned."
            title="Marketing kit"
          >
            <div className="listing-studio-editor-form">
              <div className="listing-studio-editor-actions">
                <Button
                  onClick={() =>
                    void copyMarketingKitCopy("Full marketing kit", marketingKit.fullText)
                  }
                  variant="secondary"
                >
                  Copy full kit
                </Button>
                {marketingKit.bundles.map((bundle) => (
                  <Button
                    key={bundle.id}
                    onClick={() => void copyMarketingKitCopy(bundle.title, bundle.text)}
                    variant="ghost"
                  >
                    Copy {bundle.title}
                  </Button>
                ))}
              </div>
              <div className="listing-studio-keyvalue-grid">
                <div className="listing-studio-keyvalue-card">
                  <span>Marketing angle</span>
                  <strong>Caption, blurb, follow-up</strong>
                  <span>
                    Everything below is derived from the same saved packet and the current poster draft.
                  </span>
                </div>
                <div className="listing-studio-keyvalue-card">
                  <span>Export posture</span>
                  <strong>Manual and review-first</strong>
                  <span>
                    No Canva sync, PNG render, or auto-send is implied by these copy blocks.
                  </span>
                </div>
                <div className="listing-studio-keyvalue-card">
                  <span>Bundle sets</span>
                  <strong>{marketingKit.bundles.length} campaign bundles</strong>
                  <span>
                    Use the bundle cards below when you want one copy block instead of section-by-section assembly.
                  </span>
                </div>
              </div>

              <div className="listing-studio-keyvalue-grid">
                {marketingKit.bundles.map((bundle) => (
                  <div className="listing-studio-keyvalue-card" key={bundle.id}>
                    <div className="listing-studio-card-meta">
                      <span className="office-status-badge office-status-badge-neutral">
                        {bundle.note}
                      </span>
                      <span className="office-status-badge office-status-badge-success">
                        Campaign bundle
                      </span>
                    </div>
                    <strong>{bundle.title}</strong>
                    <span>{bundle.description}</span>
                    <span style={{ whiteSpace: "pre-wrap" }}>{bundle.text}</span>
                    <div className="listing-studio-editor-actions">
                      <Button
                        onClick={() => void copyMarketingKitCopy(bundle.title, bundle.text)}
                        variant="secondary"
                      >
                        Copy bundle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="listing-studio-detail-section-list">
                {marketingKit.sections.map((section) => (
                  <div className="listing-studio-detail-section-block" key={section.title}>
                    <div className="listing-studio-editor-actions" style={{ justifyContent: "space-between" }}>
                      <strong>{section.title}</strong>
                      <Button
                        onClick={() =>
                          void copyMarketingKitCopy(
                            `${section.title} block`,
                            [
                              section.title,
                              section.subtitle,
                              ...section.variants.map(
                                (variant) => `\n${variant.label}\n${variant.note}\n${variant.text}`,
                              ),
                            ].join("\n"),
                          )
                        }
                        variant="ghost"
                      >
                        Copy section
                      </Button>
                    </div>
                    <p className="listing-studio-muted">{section.subtitle}</p>
                    <div className="listing-studio-keyvalue-grid">
                      {section.variants.map((variant) => (
                        <div className="listing-studio-keyvalue-card" key={variant.id}>
                          <div className="listing-studio-card-meta">
                            <span className="office-status-badge office-status-badge-neutral">
                              {variant.note}
                            </span>
                            <span className="office-status-badge office-status-badge-success">
                              {section.title}
                            </span>
                          </div>
                          <strong>{variant.label}</strong>
                          <span>{variant.text}</span>
                          <div className="listing-studio-editor-actions">
                            <Button
                              onClick={() => void copyMarketingKitCopy(variant.label, variant.text)}
                              variant="secondary"
                            >
                              Copy
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="listing-studio-muted">
                {marketingKit.summaryLine}. The kit keeps the scan path, contact block, and packet copy aligned without pretending there is an external marketing service behind it.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These fields only affect the customer-facing packet. The imported snapshot stays unchanged."
            title="Packet editor"
          >
            <div className="listing-studio-editor-form">
              <div className="listing-studio-keyvalue-grid">
                <label className="listing-studio-filter-field">
                  <span>Contact name</span>
                  <TextInput value={contactName} onChange={(event) => setContactName(event.target.value)} />
                </label>
                <label className="listing-studio-filter-field">
                  <span>Contact title</span>
                  <TextInput value={contactTitle} onChange={(event) => setContactTitle(event.target.value)} />
                </label>
                <label className="listing-studio-filter-field">
                  <span>Contact phone</span>
                  <TextInput value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                </label>
                <label className="listing-studio-filter-field">
                  <span>Contact email</span>
                  <TextInput value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
                </label>
              </div>
              <label className="listing-studio-filter-field">
                <span>Headline</span>
                <TextInput value={headline} onChange={(event) => setHeadline(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field">
                <span>Summary</span>
                <TextareaInput
                  rows={5}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                />
              </label>
              <label className="listing-studio-filter-field">
                <span>Bullet points</span>
                <TextareaInput
                  rows={6}
                  value={bulletText}
                  onChange={(event) => setBulletText(event.target.value)}
                />
              </label>
              <label className="listing-studio-filter-field">
                <span>Agent note</span>
                <TextareaInput
                  rows={5}
                  value={agentNote}
                  onChange={(event) => setAgentNote(event.target.value)}
                />
              </label>
              <div className="listing-studio-editor-actions">
                <Button disabled={isDeleting} onClick={savePack} variant="primary">
                  {isSaving ? "Saving..." : "Save packet"}
                </Button>
                <Button
                  disabled={isDeleting}
                  onClick={publishShare}
                  variant="secondary"
                >
                  {isSharing ? "Publishing..." : shareEnabled ? "Refresh share link" : "Publish share"}
                </Button>
                <a
                  className="office-button office-button-ghost"
                  href={`/api/listing-studio/listings/${detail.packId}/pdf`}
                  target="_blank"
                >
                  Export PDF
                </a>
                {shareUrl ? (
                  <>
                    <a
                      className="office-button office-button-ghost"
                      href={shareUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open share page
                    </a>
                    <Button disabled={isDeleting} onClick={copyShareUrl} variant="ghost">
                      Copy share link
                    </Button>
                  </>
                ) : null}
              </div>
              {statusMessage ? (
                <p className="listing-studio-status-message">{statusMessage}</p>
              ) : null}
            </div>
          </SectionCard>

        {detail.floorPlans.length ? (
          <SectionCard
            className="office-list-card"
            subtitle="Floor plan entries parsed from the source page."
            title="Floor plans"
          >
            <div className="listing-studio-floorplan-list">
              {detail.floorPlans.map((plan, index) => (
                <a
                  className="listing-studio-floorplan-link"
                  href={
                    plan.assetId
                      ? `/api/listing-studio/assets/${plan.assetId}`
                      : plan.url || "#"
                  }
                  key={`${plan.label}-${index}`}
                  target="_blank"
                >
                  {plan.label}
                </a>
              ))}
            </div>
          </SectionCard>
        ) : null}

          <SectionCard
            className="office-list-card"
            subtitle="The import source stays visible so the packet always keeps attribution and an audit trail."
            title="Source"
          >
            <div className="listing-studio-source-card">
              <span className="office-status-badge office-status-badge-neutral">
                {detail.sourceSite}
              </span>
              <a href={detail.sourceUrl} rel="noreferrer" target="_blank">
                Open original listing
              </a>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Delete the saved packet, downloaded files, and share history from Listing Studio."
            title="Danger zone"
          >
            <div className="listing-studio-editor-form">
              <p className="listing-studio-muted">
                This only deletes the local Listing Studio record. The source StreetEasy or Zillow page is untouched.
              </p>
              <Button
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(true)}
                variant="danger"
              >
                {isDeleting ? "Deleting..." : "Delete listing"}
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
      <ConfirmActionDialog
        cancelLabel="Keep listing"
        confirmLabel={isDeleting ? "Deleting..." : "Delete listing"}
        confirmVariant="danger"
        description="This permanently removes the imported packet, downloaded images, raw source files, share events, and generated PDF for this listing."
        isOpen={isDeleteDialogOpen}
        onCancel={() => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={deleteListing}
        title="Delete this listing?"
      >
        <p className="listing-studio-muted">
          You can always save the source page again later, but this current packet will be gone.
        </p>
      </ConfirmActionDialog>
    </>
  );
}
