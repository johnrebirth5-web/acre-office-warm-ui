import { SectionCard } from "@acre/ui";
import { requireSessionContext } from "../../../../../lib/auth-session";
import { getServerI18n } from "../../../../../lib/i18n/server";
import { ListingStudioExtensionApprovalClient } from "./approval-client";

type ListingStudioExtensionConnectPageProps = {
  params: Promise<{ challengeToken: string }>;
};

export default async function ListingStudioExtensionConnectPage(
  props: ListingStudioExtensionConnectPageProps,
) {
  const context = await requireSessionContext();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const { challengeToken } = await props.params;

  return (
    <div className="office-list-page listing-studio-page">
      <section className="office-page-header listing-studio-header">
        <div className="office-page-heading">
          <span className="office-eyebrow">
            {isZh ? "房源工作室" : "Listing Studio"}
          </span>
          <h2>
            {isZh ? "授权 Chrome 扩展访问" : "Approve Chrome extension access"}
          </h2>
        </div>
      </section>

      <div className="office-list-page-stack listing-studio-stack">
        <SectionCard
          className="office-list-card"
          subtitle={
            isZh
              ? "授权此浏览器后，扩展就能把房源保存到当前组织。"
              : "Approve this browser so the extension can save listings into your current organization."
          }
          title={isZh ? "授权访问" : "Approve access"}
        >
          <div className="listing-studio-approval-grid">
            <div className="listing-studio-approval-field">
              <span>{isZh ? "组织" : "Organization"}</span>
              <strong>{context.currentOrganization.name}</strong>
            </div>
            <div className="listing-studio-approval-field">
              <span>{isZh ? "办公室" : "Office"}</span>
              <strong>
                {context.currentOffice?.name ??
                  (isZh ? "全公司范围" : "Company-wide scope")}
              </strong>
            </div>
            <div className="listing-studio-approval-field">
              <span>{isZh ? "用户" : "User"}</span>
              <strong>
                {`${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() ||
                  context.currentUser.email}
              </strong>
            </div>
          </div>
          <ListingStudioExtensionApprovalClient challengeToken={challengeToken} />
        </SectionCard>
      </div>
    </div>
  );
}
