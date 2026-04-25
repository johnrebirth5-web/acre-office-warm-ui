import Link from "next/link";
import { SectionCard } from "@acre/ui";
import { getServerI18n } from "../../../../lib/i18n/server";
import { LISTING_STUDIO_EXTENSION_STORE_URL } from "../../extension-store-url";

export default async function ListingStudioExtensionInstallPage() {
  const { locale } = await getServerI18n();
  const isZh = locale === "zh-CN";

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">
            {isZh ? "房源工作室" : "Listing Studio"}
          </span>
          <h2>{isZh ? "安装 Chrome 扩展" : "Install the Chrome extension"}</h2>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="office-list-card"
          subtitle={
            isZh
              ? "先从 Chrome Web Store 安装扩展，然后回到这里继续。"
              : "Install the extension from the Chrome Web Store, then come back here."
          }
          title={isZh ? "安装扩展" : "Install extension"}
        >
          <div className="listing-studio-install-layout">
            <div className="listing-studio-install-copy">
              <strong>
                {isZh ? "请先在此浏览器安装" : "Install on this browser first"}
              </strong>
              <p>
                {isZh
                  ? "安装扩展后，回到房源工作室标签页。Acre 会检测扩展并自动继续浏览器连接流程，无需再次手动点击。"
                  : "After the extension is installed, return to your Listing Studio tab. Acre will detect the extension, continue the browser connection flow automatically, and finish approval without another manual button click."}
              </p>
            </div>
            <div className="listing-studio-install-actions">
              <a
                className="office-button office-button-primary"
                href={LISTING_STUDIO_EXTENSION_STORE_URL}
                rel="noreferrer"
                target="_blank"
              >
                {isZh ? "添加到 Chrome" : "Add to Chrome"}
              </a>
              <Link
                className="office-button office-button-secondary"
                href="/listing-studio/listings"
              >
                {isZh ? "返回我的房源" : "Back to listings"}
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle={
            isZh
              ? "Chrome 打开商店页面后，按以下步骤完成设置。"
              : "After Chrome opens the store page, follow these steps to finish setup."
          }
          title={isZh ? "设置步骤" : "Setup steps"}
        >
          <div className="listing-studio-install-steps">
            <div className="listing-studio-install-step">
              <span>01</span>
              <strong>
                {isZh ? "在 Chrome 中添加 Acre 扩展" : "Add the Acre extension in Chrome"}
              </strong>
              <p>
                {isZh
                  ? "如果此浏览器已安装，只需先重载扩展再回到这里。"
                  : "If this browser already has it, a simple extension reload is enough before you come back here."}
              </p>
            </div>
            <div className="listing-studio-install-step">
              <span>02</span>
              <strong>
                {isZh
                  ? "返回房源工作室的我的房源"
                  : "Return to your Listing Studio listings"}
              </strong>
              <p>
                {isZh
                  ? "Chrome 添加扩展后，回到刚才的房源工作室标签页。"
                  : "Go back to the same Listing Studio tab after Chrome adds the extension."}
              </p>
            </div>
            <div className="listing-studio-install-step">
              <span>03</span>
              <strong>
                {isZh
                  ? "Acre 完成浏览器连接"
                  : "Acre finishes the browser connection"}
              </strong>
              <p>
                {isZh
                  ? "房源页面会检测扩展；如有需要会刷新一次、打开授权页，并在浏览器连接完成后回到这里。"
                  : "Listings will detect the extension, refresh once if needed, open the approval page, then return here once the browser is linked."}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
