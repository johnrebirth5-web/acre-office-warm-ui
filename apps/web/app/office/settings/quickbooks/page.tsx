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

type QuickBooksConnectionStatus = ReturnType<typeof parseQuickBooksOfficeConnectionStatuses> extends Map<
  string,
  infer TValue
>
  ? TValue
  : never;

type QuickBooksConnectionState = "ready" | "partial" | "mapped";

function resolveConnectionState(status: QuickBooksConnectionStatus | undefined): QuickBooksConnectionState {
  if (
    status?.hasRealmId &&
    status.hasRefreshToken &&
    status.hasApAccountId &&
    status.hasAgentCommissionExpenseAccountId
  ) {
    return "ready";
  }

  if (
    status?.hasRealmId ||
    status?.hasRefreshToken ||
    status?.hasApAccountId ||
    status?.hasAgentCommissionExpenseAccountId
  ) {
    return "partial";
  }

  return "mapped";
}

function resolveConnectionTone(state: QuickBooksConnectionState) {
  if (state === "ready") {
    return "success";
  }

  return state === "partial" ? "warning" : "accent";
}

function resolveConnectionLabel(state: QuickBooksConnectionState) {
  if (state === "ready") {
    return "Ready";
  }

  return state === "partial" ? "Partial config" : "Mapped";
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
  const readyConnectionCount = quickBooksOfficeMappings.filter((mapping) => {
    const status = connectionStatuses.get(mapping.officeSlug);

    return resolveConnectionState(status) === "ready";
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
              value={oauthConfig.isConfigured ? "Production keys present" : "Production keys missing"}
            />
            <SummaryChip label="Office mapping" tone="accent" value="3/3 mapped" />
            <SummaryChip label="Posting config" tone="accent" value={`${readyConnectionCount}/3 ready`} />
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
          subtitle="The three Acre offices are mapped to the three live QuickBooks companies. Posting still needs production OAuth and account IDs."
          title="Company mapping"
        >
          {oauthConfig.credentialSource === "legacy" ? (
            <p className="office-inline-success">
              Local OAuth credentials are available from the legacy QuickBooks
              env names. Production should use the ACRE_QUICKBOOKS_* env names.
            </p>
          ) : null}

          {!oauthConfig.isConfigured ? (
            <p className="office-inline-warning">
              Company mapping is ready. Add QuickBooks production OAuth
              credentials to this server before using Connect. The sandbox keys
              cannot connect these live QuickBooks companies.
            </p>
          ) : null}

          <div className="office-quickbooks-office-list">
            {quickBooksOfficeMappings.map((mapping) => {
              const status = connectionStatuses.get(mapping.officeSlug);
              const connectionState = resolveConnectionState(status);

              return (
                <article className="office-quickbooks-office-card" key={mapping.officeSlug}>
                  <div className="office-quickbooks-office-copy">
                    <div className="office-quickbooks-office-heading">
                      <strong>{mapping.officeLabel}</strong>
                      <StatusBadge tone={resolveConnectionTone(connectionState)}>
                        {resolveConnectionLabel(connectionState)}
                      </StatusBadge>
                    </div>
                    <p>
                      QuickBooks company:{" "}
                      <span>{status?.companyName || mapping.quickBooksCompanyName}</span>
                    </p>
                    <small>Mapping key: {mapping.officeSlug}</small>
                  </div>

                  <div className="office-quickbooks-office-actions">
                    {oauthConfig.isConfigured ? (
                      <a
                        className="office-button office-button-secondary office-button-sm"
                        href={`/api/office/settings/quickbooks/connect?office=${mapping.officeSlug}`}
                      >
                        Connect
                      </a>
                    ) : (
                      <span className="office-button office-button-secondary office-button-sm office-button-disabled">
                        Needs production keys
                      </span>
                    )}
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
