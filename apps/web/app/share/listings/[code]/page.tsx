import { getFrontOfficeListingSharePageSnapshot } from "@acre/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  consumePublicTokenRateLimit,
  PUBLIC_LISTING_SHARE_READ_RATE_LIMIT_OPTIONS,
} from "../../../../lib/public-token-rate-limit";
import { getServerI18n } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

type PublicListingSharePageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function PublicListingSharePage(
  props: PublicListingSharePageProps,
) {
  const { locale } = await getServerI18n();
  const isZh = locale === "zh-CN";
  const { code } = await props.params;
  const headerStore = await headers();
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/listings/share/read",
    request: headerStore,
    token: code,
    options: PUBLIC_LISTING_SHARE_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    notFound();
  }

  const snapshot = await getFrontOfficeListingSharePageSnapshot(code);

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="listing-share-shell">
      <section className="listing-share-card">
        <div className="listing-share-head">
          <span className="listing-share-eyebrow">
            {snapshot.shareSurfaceLabel}
          </span>
          <span className="listing-share-status">{snapshot.statusLabel}</span>
        </div>

        <div className="listing-share-copy">
          <h1>{snapshot.listingTitle}</h1>
          <p>{snapshot.summaryLabel}</p>
          <p>{snapshot.shareContextLabel}</p>
        </div>

        <section
          className="listing-share-metrics"
          aria-label={isZh ? "房源信息" : "Listing facts"}
        >
          <div className="listing-share-facts-primary">
            <article>
              <span>{isZh ? "价格" : "Price"}</span>
              <strong>{snapshot.priceLabel}</strong>
            </article>
            <article>
              <span>{isZh ? "区域" : "Area"}</span>
              <strong>{snapshot.areaLabel}</strong>
            </article>
            <article>
              <span>{isZh ? "户型" : "Layout"}</span>
              <strong>{snapshot.factsLabel}</strong>
            </article>
          </div>

          <div className="listing-share-facts-secondary">
            <article>
              <span>{isZh ? "分享人" : "Shared by"}</span>
              <strong>{snapshot.agentLabel}</strong>
            </article>
            <article>
              <span>{isZh ? "渠道" : "Channel"}</span>
              <strong>{snapshot.channelLabel}</strong>
            </article>
            <article>
              <span>{isZh ? "状态" : "Availability"}</span>
              <strong>{snapshot.statusLabel}</strong>
            </article>
          </div>
        </section>

        <div className="listing-share-actions">
          {snapshot.agentPhone ? (
            <a className="office-button" href={`tel:${snapshot.agentPhone}`}>
              {isZh ? "联系经纪人" : "Call agent"}
            </a>
          ) : null}
          {snapshot.agentEmail ? (
            <a
              className="office-button-secondary"
              href={`mailto:${snapshot.agentEmail}`}
            >
              {isZh ? "邮件联系经纪人" : "Email agent"}
            </a>
          ) : null}
          {snapshot.sourceUrl ? (
            <a
              className="office-button-secondary"
              href={snapshot.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {isZh ? "打开原始房源" : "Open source listing"}
            </a>
          ) : null}
        </div>

        <footer className="listing-share-footer">
          <strong>{snapshot.organizationLabel}</strong>
          <p>{snapshot.followUpLabel}</p>
          <p>{snapshot.privacyLabel}</p>
        </footer>
      </section>
    </main>
  );
}
