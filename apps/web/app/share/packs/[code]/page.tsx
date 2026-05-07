import { getStudioListingPublicPack } from "@acre/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { formatDate } from "../../../../lib/i18n/format";
import { type LocaleCode } from "../../../../lib/i18n/config";
import { getServerI18n } from "../../../../lib/i18n/server";
import {
  consumePublicTokenRateLimit,
  PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS,
} from "../../../../lib/public-token-rate-limit";
import {
  collectListingStudioFinancialHighlights,
  isListingStudioFinancialFactLabel,
} from "../../../listing-studio/listing-studio-financial-highlights";

type ListingStudioPublicSharePageProps = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatLegacyShareRetirementDate(value: Date, locale: LocaleCode) {
  return (
    formatDate(value, locale, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }) ||
    value.toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  );
}

function formatPublicListingText(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  return value
    .replace(/\bBedrooms?\b/gi, "卧室")
    .replace(/\bBathrooms?\b/gi, "卫浴")
    .replace(/\bBeds?\b/gi, "卧室")
    .replace(/\bBaths?\b/gi, "卫浴")
    .replace(/\bSqft\b/gi, "面积")
    .replace(/\bSq\.?\s?Ft\.?\b/gi, "平方英尺")
    .replace(/\bProperty type\b/gi, "物业类型")
    .replace(/\bYear built\b/gi, "建造年份")
    .replace(/\bList date\b/gi, "挂牌日期")
    .replace(/\bCommon charges\b/gi, "管理费")
    .replace(/\bTax abatement\b/gi, "税收减免")
    .replace(/\bTaxes\b/gi, "房产税")
    .replace(/\bTransit details captured\b/gi, "已采集交通信息")
    .replace(/\bAmenities\b/gi, "设施")
    .replace(/\bServices & Facilities\b/gi, "服务与配套")
    .replace(/\bWellness & Recreation\b/gi, "健身与休闲")
    .replace(/\bShared Outdoor Space\b/gi, "共享户外空间")
    .replace(/\bFamily & Pets\b/gi, "家庭与宠物")
    .replace(/\bUnit \/ Apartment Amenities\b/gi, "户内设施")
    .replace(/\bViews \/ Exposure\b/gi, "景观与朝向");
}

function buildContactInitials(contact: { name: string }) {
  return (
    contact.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "A"
  );
}

export default async function ListingStudioPublicSharePage(
  props: ListingStudioPublicSharePageProps,
) {
  const { locale } = await getServerI18n();
  const isZh = locale === "zh-CN";
  const { code } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const viewerFingerprint =
    typeof searchParams.viewer === "string" ? searchParams.viewer : null;
  const headerStore = await headers();
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/listing-studio/packs/read",
    request: headerStore,
    token: code,
    options: PUBLIC_LISTING_STUDIO_SHARE_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    notFound();
  }

  const snapshot = await getStudioListingPublicPack({
    shareCode: code,
    viewerFingerprint,
    referrer: headerStore.get("referer"),
    userAgent: headerStore.get("user-agent"),
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip"),
  });

  if (!snapshot) {
    notFound();
  }

  const financialHighlights = collectListingStudioFinancialHighlights(snapshot);
  const primaryFacts = snapshot.facts.filter(
    (fact) => !isListingStudioFinancialFactLabel(fact.label),
  );

  return (
    <main className="listing-studio-share-shell">
      <div className="listing-studio-share-page">
        {snapshot.usesLegacyShareCode && snapshot.legacyShareCodeExpiresAt ? (
          <div className="public-share-legacy-notice" role="status">
            <p>
              {isZh ? "此链接将在 " : "This link will be retired on "}
              <strong>
                {formatLegacyShareRetirementDate(
                  snapshot.legacyShareCodeExpiresAt,
                  locale,
                )}
              </strong>
              {isZh
                ? " 停用。请向发送人索取新的链接。"
                : ". Please ask the sender for an updated link."}
            </p>
          </div>
        ) : null}

        <section className="listing-studio-share-hero">
          <div className="listing-studio-share-copy">
            <span className="office-eyebrow">
              {isZh ? "Acre 房源" : "Acre listing"}
            </span>
            <h1>{snapshot.headline}</h1>
            <p>{snapshot.summary}</p>
            <div className="listing-studio-share-price">{snapshot.priceLabel}</div>
            <div className="listing-studio-share-address">
              <strong>{snapshot.addressLine}</strong>
              {snapshot.locationLine ? <span>{snapshot.locationLine}</span> : null}
            </div>
            <div
              className="listing-studio-share-financial-row"
              aria-label={isZh ? "房源费用" : "Listing fees"}
            >
              {financialHighlights.map((item) => (
                <span className="listing-studio-share-financial-chip" key={item.key}>
                  {formatPublicListingText(item.label, isZh)} {item.value}
                </span>
              ))}
            </div>
          </div>
          {snapshot.selectedAssets[0] ? (
            <div className="listing-studio-share-hero-media">
              <img
                alt={snapshot.title}
                src={`/api/listing-studio/assets/${snapshot.selectedAssets[0].id}?shareCode=${snapshot.code}`}
              />
            </div>
          ) : null}
        </section>

        <section className="listing-studio-share-facts">
          {primaryFacts.map((fact) => (
            <div className="listing-studio-fact-card" key={fact.label}>
              <span>{formatPublicListingText(fact.label, isZh)}</span>
              <strong>{formatPublicListingText(fact.value, isZh)}</strong>
            </div>
          ))}
        </section>

        {snapshot.selectedAssets.length > 1 ? (
          <section className="listing-studio-share-gallery">
            {snapshot.selectedAssets.slice(1).map((asset) => (
              <div className="listing-studio-share-gallery-item" key={asset.id}>
                <img
                  alt={asset.label ?? snapshot.title}
                  src={`/api/listing-studio/assets/${asset.id}?shareCode=${snapshot.code}`}
                />
              </div>
            ))}
          </section>
        ) : null}

        <section className="listing-studio-share-sections">
          <div className="listing-studio-share-section">
            <h2>{isZh ? "房源概览" : "Listing overview"}</h2>
            {snapshot.descriptionText ? <p>{snapshot.descriptionText}</p> : null}
            {snapshot.agentNote ? (
              <blockquote>{snapshot.agentNote}</blockquote>
            ) : null}
          </div>

          {snapshot.sourceFacts.length ? (
            <div className="listing-studio-share-section">
              <h2>{isZh ? "原始房源信息" : "Source facts"}</h2>
              <div className="listing-studio-keyvalue-grid">
                {snapshot.sourceFacts.map((item) => (
                  <div className="listing-studio-keyvalue-card" key={item.label}>
                    <span>{formatPublicListingText(item.label, isZh)}</span>
                    <strong>{formatPublicListingText(item.value, isZh)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {snapshot.amenities.length ? (
            <div className="listing-studio-share-section">
              <h2>{isZh ? "设施" : "Amenities"}</h2>
              {snapshot.amenities.map((section) => (
                <div className="listing-studio-pill-group" key={section.title}>
                  <strong>{formatPublicListingText(section.title, isZh)}</strong>
                  <div className="listing-studio-pill-row">
                    {section.items.map((item) => (
                      <span className="listing-studio-pill" key={item}>
                        {formatPublicListingText(item, isZh)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {snapshot.transit.length ? (
            <div className="listing-studio-share-section">
              <h2>{isZh ? "交通" : "Transit"}</h2>
              <div className="listing-studio-transit-list">
                {snapshot.transit.map((item) => (
                  <div
                    className="listing-studio-transit-item"
                    key={`${item.label}-${item.distanceLabel ?? ""}`}
                  >
                    <strong>{item.label}</strong>
                    <span>
                      {formatPublicListingText(
                        item.detail ?? "Transit details captured",
                        isZh,
                      )}
                    </span>
                    {item.distanceLabel ? <em>{item.distanceLabel}</em> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {snapshot.propertyHistory.length ? (
            <div className="listing-studio-share-section">
              <h2>{isZh ? "历史记录" : "History"}</h2>
              <div className="listing-studio-detail-section-list">
                {snapshot.propertyHistory.map((section) => (
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
            </div>
          ) : null}

          {snapshot.capturedSections.length ? (
            <div className="listing-studio-share-section">
              <h2>{isZh ? "更多详情" : "Additional details"}</h2>
              <div className="listing-studio-detail-section-list">
                {snapshot.capturedSections.map((section) => (
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
            </div>
          ) : null}
        </section>

        <footer className="listing-studio-share-footer">
          {snapshot.contact.avatarUrl ? (
            <img
              alt={`${snapshot.contact.name} avatar`}
              className="listing-studio-share-footer-avatar"
              src={snapshot.contact.avatarUrl}
            />
          ) : (
            <div className="listing-studio-share-footer-avatar" aria-hidden="true">
              {buildContactInitials(snapshot.contact)}
            </div>
          )}
          <div>
            <strong>{snapshot.contact.name}</strong>
            <span>{snapshot.contact.title}</span>
            {snapshot.contact.phone ? <span>{snapshot.contact.phone}</span> : null}
            {snapshot.contact.email ? <span>{snapshot.contact.email}</span> : null}
          </div>
          <div className="listing-studio-share-footer-meta">
            <span>
              {isZh ? `来源：${snapshot.sourceSite}` : `Source: ${snapshot.sourceSite}`}
            </span>
            <a href={snapshot.sourceUrl} rel="noreferrer" target="_blank">
              {isZh ? "查看原始房源" : "View original listing"}
            </a>
            <span>
              {isZh ? `采集于 ${snapshot.capturedAtLabel}` : `Captured ${snapshot.capturedAtLabel}`}
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
