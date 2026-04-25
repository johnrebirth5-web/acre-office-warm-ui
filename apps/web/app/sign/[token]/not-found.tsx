import { SignatureStatusCallout } from "./signature-status-callout";
import { getServerI18n } from "../../../lib/i18n/server";

export default async function PublicSignatureNotFound() {
  const { locale } = await getServerI18n();
  const isZh = locale === "zh-CN";

  return (
    <main className="public-signature-empty-shell">
      <section className="public-signature-empty-card">
        <p className="public-signature-eyebrow">
          {isZh ? "Acre 签署请求" : "Acre signature request"}
        </p>
        <h1>
          {isZh ? "无法打开这个签署链接。" : "We couldn't open this signing link."}
        </h1>
        <SignatureStatusCallout
          description={
            isZh
              ? "请检查发送人提供的完整链接，或让对方重新发送签署请求。"
              : "Check the full link from the sender or ask them to send a fresh signing request."
          }
          icon="question"
          title={isZh ? "此链接无效。" : "This link isn't valid."}
          tone="info"
        />
      </section>
    </main>
  );
}
