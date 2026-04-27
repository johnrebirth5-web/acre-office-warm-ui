import { canManageOfficeSettings } from "@acre/auth";
import { ListPageStack, SectionCard, StatusBadge, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import {
  getQuickBooksProductionAppUrls,
  parseQuickBooksOfficeConnectionStatuses,
  quickBooksOfficeMappings,
  readQuickBooksOAuthConfig,
} from "../../../../lib/quickbooks-setup";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
import { OfficeSettingsNav } from "../settings-nav";

function resolveConnectionTone(isReady: boolean) {
  return isReady ? "success" : "warning";
}

function resolveConnectionLabel(isReady: boolean) {
  return isReady ? "Mapped" : "Needs config";
}

function QuickBooksUrlRow(props: { label: string; value: string }) {
  return (
    <div className="office-quickbooks-url-row">
      <span>{props.label}</span>
      <code>{props.value}</code>
    </div>
  );
}
export default async function OfficeSettingsQuickBooksPage() {
  const context = await requireOfficeSession();

  if (!canManageOfficeSettings(context.currentMembership)) {
    redirect("/office/settings");
  }

  const appUrls = getQuickBooksProductionAppUrls();
  const oauthConfig = readQuickBooksOAuthConfig();
  const connectionStatuses = parseQuickBooksOfficeConnectionStatuses();
  const mappedCount = quickBooksOfficeMappings.filter((mapping) => {
    const status = connectionStatuses.get(mapping.officeSlug);

    return Boolean(
      status?.hasRealmId &&
        status.hasRefreshToken &&
        status.hasApAccountId &&
        status.hasAgentCommissionExpenseAccountId,
    );
  }).length;

  return (
    <OfficeListPageShell className="office-settings-list-page">
      <OfficeListPageHeader
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Organization" value={context.currentOrganization.name} />
            <SummaryChip
              label="OAuth"
              tone={oauthConfig.isConfigured ? "accent" : "default"}
              value={oauthConfig.isConfigured ? "Credentials present" : "Missing credentials"}
            />
            <SummaryChip label="Company mappings" tone="accent" value={`${mappedCount}/3`} />
          </>
        }
        title="QuickBooks"
      />

      <ListPageStack className="office-settings-list-stack">
        <OfficeSettingsNav currentAccess={context.currentMembership} />

        <section className="office-settings-card-grid office-quickbooks-setup-grid">
          <SectionCard
            subtitle="Use these production URLs in Intuit Developer after the public pages are deployed."
            title="Intuit app details"
          >
            <div className="office-quickbooks-url-list">
              <QuickBooksUrlRow label="Host domain" value={appUrls.hostDomain} />
              <QuickBooksUrlRow label="Launch URL" value={appUrls.launchUrl} />
              <QuickBooksUrlRow label="Connect / reconnect URL" value={appUrls.connectUrl} />
              <QuickBooksUrlRow label="OAuth redirect URI" value={appUrls.redirectUrl} />
              <QuickBooksUrlRow label="Disconnect URL" value={appUrls.disconnectUrl} />
              <QuickBooksUrlRow label="Privacy policy URL" value={appUrls.privacyUrl} />
              <QuickBooksUrlRow label="Terms / EULA URL" value={appUrls.termsUrl} />
            </div>
          </SectionCard>

          <SectionCard
            subtitle="This integration creates unpaid QuickBooks bills only. Payment remains manual in QuickBooks."
            title="Posting behavior"
          >
            <div className="office-quickbooks-policy-list">
              <p>
                Agent-confirmed payout statements can be posted to QuickBooks as
                Accounts Payable unpaid bills.
              </p>
              <p>
                Acre routes bills by office/company and ignores the deprecated
                Acre Media LLC QuickBooks company.
              </p>
              <p>
                The cashier still reviews the bill in QuickBooks and pays it
                manually.
              </p>
            </div>
          </SectionCard>
        </section>

        <SectionCard
          subtitle="Connect each live QuickBooks company once production credentials are available."
          title="Company mapping"
        >
          {oauthConfig.credentialSource === "legacy" ? (
            <p className="office-inline-success">
              Local OAuth credentials are available from the legacy QuickBooks
              env names. Production should use the ACRE_QUICKBOOKS_* env names.
            </p>
          ) : null}

          {!oauthConfig.isConfigured ? (
            <p className="office-inline-error">
              QuickBooks OAuth credentials are not configured on this server.
            </p>
          ) : null}

          <div className="office-quickbooks-office-list">
            {quickBooksOfficeMappings.map((mapping) => {
              const status = connectionStatuses.get(mapping.officeSlug);
              const isReady = Boolean(
                status?.hasRealmId &&
                  status.hasRefreshToken &&
                  status.hasApAccountId &&
                  status.hasAgentCommissionExpenseAccountId,
              );

              return (
                <article className="office-quickbooks-office-card" key={mapping.officeSlug}>
                  <div className="office-quickbooks-office-copy">
                    <div className="office-quickbooks-office-heading">
                      <strong>{mapping.officeLabel}</strong>
                      <StatusBadge tone={resolveConnectionTone(isReady)}>
                        {resolveConnectionLabel(isReady)}
                      </StatusBadge>
                    </div>
                    <p>
                      QuickBooks company:{" "}
                      <span>{status?.companyName || mapping.quickBooksCompanyName}</span>
                    </p>
                    <small>Mapping key: {mapping.officeSlug}</small>
                  </div>

                  <div className="office-quickbooks-office-actions">
                    <a
                      className="office-button office-button-secondary office-button-sm"
                      href={`/api/office/settings/quickbooks/connect?office=${mapping.officeSlug}`}
                    >
                      Connect
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      </ListPageStack>
    </OfficeListPageShell>
  );
}
