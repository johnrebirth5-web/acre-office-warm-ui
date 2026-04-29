"use client";

import type { StudioListingPublicCollectionSnapshot } from "@acre/db";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../../lib/i18n/client";
import { collectListingStudioFinancialHighlights } from "../../../listing-studio/listing-studio-financial-highlights";
import { ListingStudioPublicCollectionMap } from "./listing-studio-public-collection-map";

type PublicCollectionSnapshot = StudioListingPublicCollectionSnapshot;
type PublicCollectionListing = PublicCollectionSnapshot["listings"][number];

function formatUpdatedLabel(value: string, locale: string) {
  const date = new Date(value);
  const isZh = locale === "zh-CN";

  if (Number.isNaN(date.getTime())) {
    return isZh ? "最近更新" : "Recently updated";
  }

  return date.toLocaleDateString(isZh ? "zh-CN" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatListingTypeLabel(value: string | null, isZh: boolean) {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "sale") {
    return isZh ? "出售" : "For sale";
  }

  if (normalized === "rent") {
    return isZh ? "出租" : "Rental";
  }

  return null;
}

function formatFactLabel(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  return value
    .replace(/\bBeds?\b/gi, "卧室")
    .replace(/\bBaths?\b/gi, "卫浴")
    .replace(/\bSq\.?\s?Ft\.?\b/gi, "平方英尺")
    .replace(/\bSquare Feet\b/gi, "平方英尺")
    .replace(/\bCommon Charges\b/gi, "管理费")
    .replace(/\bTax Abatement\b/gi, "税收减免")
    .replace(/\bTaxes\b/gi, "房产税")
    .replace(/\bFor sale\b/gi, "出售")
    .replace(/\bRental\b/gi, "出租")
    .replace(/\bActive\b/gi, "在售")
    .replace(/\bPending\b/gi, "待成交")
    .replace(/\bClosed\b/gi, "已成交");
}

function formatStatusLabel(
  value: string | null,
  listingTypeLabel: string | null,
  isZh: boolean,
) {
  if (!value) {
    return listingTypeLabel || "-";
  }

  return formatFactLabel(value, isZh);
}

function getFacts(line: string, isZh: boolean) {
  return line
    .split(" · ")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => formatFactLabel(item, isZh))
    .slice(0, 3);
}

function buildAssetSrc(assetId: string | null, code: string) {
  return assetId
    ? `/api/listing-studio/assets/${assetId}?shareCode=${code}`
    : null;
}

function getGalleryAssetIds(listing: PublicCollectionListing) {
  const orderedIds = [
    listing.heroAssetId,
    ...listing.selectedAssets
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((asset) => asset.id),
  ];

  return Array.from(new Set(orderedIds.filter(Boolean))) as string[];
}

function getFactValue(
  listing: PublicCollectionListing,
  patterns: RegExp[],
  fallbackIndex: number,
  isZh: boolean,
) {
  const matched = listing.facts.find((fact) =>
    patterns.some((pattern) => pattern.test(fact.label)),
  );

  if (matched?.value) {
    return formatFactLabel(matched.value, isZh);
  }

  return getFacts(listing.factsLine, isZh)[fallbackIndex] ?? "-";
}

function getAmenities(listing: PublicCollectionListing) {
  return listing.amenities.flatMap((section) => section.items).slice(0, 8);
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function ListingStudioCollectionDetailView(props: {
  snapshot: PublicCollectionSnapshot;
  listing: PublicCollectionListing;
  onCopyEmail: () => void;
  onBack: () => void;
  isZh: boolean;
}) {
  const { isZh, listing, onBack, onCopyEmail, snapshot } = props;
  const galleryAssetIds = useMemo(() => getGalleryAssetIds(listing), [listing]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const currentAssetId = galleryAssetIds[currentImageIndex] ?? null;
  const currentImageSrc = buildAssetSrc(currentAssetId, snapshot.code);
  const contactPhoneHref = snapshot.contact.phone
    ? `tel:${snapshot.contact.phone}`
    : null;
  const beds = getFactValue(listing, [/bed/i], 0, isZh);
  const baths = getFactValue(listing, [/bath/i], 1, isZh);
  const sqft = getFactValue(listing, [/sqft|square/i], 2, isZh);
  const amenities = getAmenities(listing);
  const listingTypeLabel = formatListingTypeLabel(listing.listingType, isZh);
  const financialHighlights = useMemo(
    () => collectListingStudioFinancialHighlights(listing),
    [listing],
  );

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [listing.packId]);

  return (
    <div className="listing-studio-collection-share-detail">
      <header className="listing-studio-collection-share-detail-header">
        <button type="button" onClick={onBack}>
          <span aria-hidden="true">{"<"}</span>
          {isZh ? "返回清单" : "Back to Collection"}
        </button>
        <strong>ACRE</strong>
      </header>

      <div className="listing-studio-collection-share-detail-body">
        {listing.agentNote ? (
          <section className="listing-studio-collection-share-detail-note">
            <span aria-hidden="true">"</span>
            <p>{listing.agentNote}</p>
            <small>
              {isZh
                ? `${snapshot.contact.name} 的备注`
                : `Note from ${snapshot.contact.name}`}
            </small>
          </section>
        ) : null}

        <section className="listing-studio-collection-share-detail-gallery">
          <div className="listing-studio-collection-share-detail-image">
            {currentImageSrc ? (
              <img
                alt={listing.displayTitle || listing.addressLine}
                src={currentImageSrc}
              />
            ) : (
              <div>{isZh ? "房源" : "Listing"}</div>
            )}
            <span>
              {galleryAssetIds.length ? currentImageIndex + 1 : 0} /{" "}
              {galleryAssetIds.length}
            </span>
          </div>

          {galleryAssetIds.length > 1 ? (
            <div className="listing-studio-collection-share-detail-thumbs">
              {galleryAssetIds.map((assetId, index) => (
                <button
                  aria-label={
                    isZh ? `查看第 ${index + 1} 张照片` : `View photo ${index + 1}`
                  }
                  className={
                    index === currentImageIndex
                      ? "is-active"
                      : undefined
                  }
                  key={assetId}
                  onClick={() => setCurrentImageIndex(index)}
                  type="button"
                >
                  <img
                    alt=""
                    src={`/api/listing-studio/assets/${assetId}?shareCode=${snapshot.code}`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="listing-studio-collection-share-detail-copy">
          <div className="listing-studio-collection-share-detail-badges">
            {listingTypeLabel ? <span>{listingTypeLabel}</span> : null}
          </div>
          <h1>{listing.priceLabel}</h1>
          <h2>{listing.displayTitle || listing.addressLine}</h2>
          <p>{listing.addressLine}</p>
          {listing.locationLine ? <p>{listing.locationLine}</p> : null}
        </section>

        <section className="listing-studio-collection-share-detail-specs">
          <div>
            <strong>{beds}</strong>
            <span>{isZh ? "卧室" : "Beds"}</span>
          </div>
          <div>
            <strong>{baths}</strong>
            <span>{isZh ? "卫浴" : "Baths"}</span>
          </div>
          <div>
            <strong>{sqft}</strong>
            <span>{isZh ? "面积" : "Sq Ft"}</span>
          </div>
        </section>

        <section
          aria-label={isZh ? "房源费用" : "Listing fees"}
          className="listing-studio-collection-share-detail-finance"
        >
          {financialHighlights.map((item) => (
            <div key={item.key}>
              <span>{formatFactLabel(item.label, isZh)}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </section>

        {listing.descriptionText ? (
          <section className="listing-studio-collection-share-detail-section">
            <h3>{isZh ? "房源介绍" : "About this home"}</h3>
            <p>{listing.descriptionText}</p>
          </section>
        ) : null}

        {amenities.length ? (
          <section className="listing-studio-collection-share-detail-section">
            <h3>{isZh ? "楼宇设施" : "Building Amenities"}</h3>
            <div className="listing-studio-collection-share-detail-amenities">
              {amenities.map((amenity) => (
                <span key={amenity}>{amenity}</span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="listing-studio-collection-share-detail-info">
          <div>
            <span>{isZh ? "楼宇" : "Building"}</span>
            <strong>{listing.buildingName || listing.displayTitle || "-"}</strong>
          </div>
          <div>
            <span>{isZh ? "状态" : "Status"}</span>
            <strong>
              {formatStatusLabel(listing.statusLabel, listingTypeLabel, isZh)}
            </strong>
          </div>
        </section>

        <section className="listing-studio-collection-share-detail-contact">
          <div className="listing-studio-collection-share-footer-avatar">
            {snapshot.contact.name.slice(0, 1).toUpperCase()}
          </div>
          <h3>{isZh ? "想进一步了解这套房源？" : "Interested in this property?"}</h3>
          <p>
            {isZh
              ? `联系 ${snapshot.contact.name} 获取更多信息。`
              : `Contact ${snapshot.contact.name} for more information.`}
          </p>
          <div>
            {contactPhoneHref ? <a href={contactPhoneHref}>{isZh ? "电话" : "Call"}</a> : null}
            {snapshot.contact.email ? (
              <button onClick={onCopyEmail} type="button">
                {isZh ? "邮件" : "Email"}
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ListingStudioPublicCollectionClient(props: {
  snapshot: PublicCollectionSnapshot;
}) {
  const { snapshot } = props;
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [emailCopyStatus, setEmailCopyStatus] = useState<string | null>(null);
  const emailCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedListing =
    snapshot.listings.find((listing) => listing.packId === selectedPackId) ??
    null;
  const heroImageSrc = buildAssetSrc(snapshot.listings[0]?.heroAssetId ?? null, snapshot.code);
  const contactPhoneHref = snapshot.contact.phone
    ? `tel:${snapshot.contact.phone}`
    : null;

  function showEmailCopyStatus(message: string) {
    setEmailCopyStatus(message);

    if (emailCopyTimerRef.current) {
      clearTimeout(emailCopyTimerRef.current);
    }

    emailCopyTimerRef.current = setTimeout(() => {
      setEmailCopyStatus(null);
      emailCopyTimerRef.current = null;
    }, 1800);
  }

  async function handleCopyEmail() {
    if (!snapshot.contact.email) {
      return;
    }

    try {
      await copyText(snapshot.contact.email);
      showEmailCopyStatus(isZh ? "邮箱已复制。" : "Email copied.");
    } catch {
      showEmailCopyStatus(isZh ? "复制失败。" : "Copy failed.");
    }
  }

  useEffect(() => {
    return () => {
      if (emailCopyTimerRef.current) {
        clearTimeout(emailCopyTimerRef.current);
      }
    };
  }, []);

  function openListing(packId: string) {
    setSelectedPackId(packId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeListing() {
    setSelectedPackId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (selectedListing) {
    return (
      <main className="listing-studio-collection-share-app">
        <div className="listing-studio-collection-share-phone">
          <ListingStudioCollectionDetailView
            isZh={isZh}
            listing={selectedListing}
            onCopyEmail={handleCopyEmail}
            onBack={closeListing}
            snapshot={snapshot}
          />
          {emailCopyStatus ? (
            <div className="listing-studio-collection-share-toast">
              {emailCopyStatus}
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="listing-studio-collection-share-app">
      <div className="listing-studio-collection-share-phone">
        <section
          className="listing-studio-collection-share-hero"
          style={
            heroImageSrc
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(26, 21, 16, 0.58), rgba(26, 21, 16, 0.12) 42%, rgba(26, 21, 16, 0.82)), url("${heroImageSrc}")`,
                }
              : undefined
          }
        >
          <header className="listing-studio-collection-share-topbar">
            <strong>ACRE</strong>
            <span>{isZh ? "共享房源清单" : "Shared Collection"}</span>
          </header>

          <div className="listing-studio-collection-share-hero-copy">
            <div className="listing-studio-collection-share-kicker">
              <span />
              <small>{isZh ? "为你精选" : "Curated for you"}</small>
              <span />
            </div>
            <h1>{snapshot.name}</h1>
            <p>
              {isZh
                ? `${snapshot.listingCount} 套纽约精选房源`
                : `${snapshot.listingCount} handpicked propert${
                    snapshot.listingCount === 1 ? "y" : "ies"
                  } in New York`}
            </p>
          </div>

          <div className="listing-studio-collection-share-agent-card">
            <div className="listing-studio-collection-share-agent-avatar">
              {snapshot.contact.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{snapshot.contact.name}</strong>
              <span>{snapshot.contact.title}</span>
            </div>
            <div className="listing-studio-collection-share-agent-actions">
              {contactPhoneHref ? <a href={contactPhoneHref}>{isZh ? "电话" : "Call"}</a> : null}
              {snapshot.contact.email ? (
                <button onClick={handleCopyEmail} type="button">
                  {isZh ? "邮件" : "Email"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="listing-studio-collection-share-scroll-cue">
            <span>{isZh ? "向下" : "Scroll"}</span>
            <i aria-hidden="true">⌄</i>
          </div>
        </section>

        <section className="listing-studio-collection-share-listings">
          <header className="listing-studio-collection-share-listings-head">
            <span>{snapshot.listingCount}</span>
            <div>
              <p>{isZh ? "房源" : "Properties"}</p>
              <h2>{isZh ? "为你挑选" : "Selected for you"}</h2>
            </div>
          </header>

          <div className="listing-studio-collection-share-list">
            {snapshot.listings.length ? (
              snapshot.listings.map((listing, index) => {
                const assetSrc = buildAssetSrc(listing.heroAssetId, snapshot.code);
                const facts = getFacts(listing.factsLine, isZh);
                const listingTypeLabel = formatListingTypeLabel(
                  listing.listingType,
                  isZh,
                );

                return (
                  <article
                    className="listing-studio-collection-share-property"
                    key={listing.packId}
                  >
                    <header className="listing-studio-collection-share-property-head">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3>{listing.displayTitle || listing.addressLine}</h3>
                        <p>{listing.locationLine}</p>
                      </div>
                    </header>

                    <button
                      className="listing-studio-collection-share-property-media"
                      onClick={() => openListing(listing.packId)}
                      type="button"
                    >
                      {assetSrc ? (
                        <img
                          alt={listing.displayTitle || listing.addressLine}
                          src={assetSrc}
                        />
                      ) : (
                        <div className="listing-studio-collection-share-property-empty">
                          {isZh ? "房源" : "Listing"}
                        </div>
                      )}
                      <div className="listing-studio-collection-share-property-badges">
                        {listingTypeLabel ? <span>{listingTypeLabel}</span> : null}
                      </div>
                      <strong>{listing.priceLabel}</strong>
                    </button>

                    <div className="listing-studio-collection-share-property-body">
                      <div className="listing-studio-collection-share-property-facts">
                        {facts.map((fact) => (
                          <span key={fact}>{fact}</span>
                        ))}
                      </div>
                      <button
                        className="listing-studio-collection-share-property-link"
                        onClick={() => openListing(listing.packId)}
                        type="button"
                      >
                        {isZh ? "查看详情" : "View Details"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="listing-studio-collection-share-empty">
                {isZh
                  ? "这个共享清单暂时还没有房源。"
                  : "This shared collection is empty right now."}
              </div>
            )}
          </div>
        </section>

        {snapshot.listings.length ? (
          <ListingStudioPublicCollectionMap
            listings={snapshot.listings}
            onOpenListing={openListing}
          />
        ) : null}

        <footer className="listing-studio-collection-share-footer">
          <div className="listing-studio-collection-share-footer-avatar">
            {snapshot.contact.name.slice(0, 1).toUpperCase()}
          </div>
          <h2>{snapshot.contact.name}</h2>
          <p>{snapshot.contact.title}</p>
          <div className="listing-studio-collection-share-footer-actions">
            {contactPhoneHref ? <a href={contactPhoneHref}>{isZh ? "电话" : "Call"}</a> : null}
            {snapshot.contact.email ? (
              <button onClick={handleCopyEmail} type="button">
                {isZh ? "邮件" : "Email"}
              </button>
            ) : null}
          </div>
          <small>
            {isZh
              ? `由 ACRE 房源系统提供 · 更新于 ${formatUpdatedLabel(
                  snapshot.updatedAt,
                  locale,
                )}`
              : `Powered by ACRE Listing System · Updated ${formatUpdatedLabel(
                  snapshot.updatedAt,
                  locale,
                )}`}
          </small>
        </footer>
        {emailCopyStatus ? (
          <div className="listing-studio-collection-share-toast">
            {emailCopyStatus}
          </div>
        ) : null}
      </div>
    </main>
  );
}
