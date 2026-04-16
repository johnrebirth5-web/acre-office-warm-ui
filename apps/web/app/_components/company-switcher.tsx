"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n/client";

type CompanyOption = {
  id: string;
  name: string;
};

type CompanySwitcherProps = {
  className?: string;
  currentCompanyId: string | null;
  companies: CompanyOption[];
  homeHref: string;
};

export function CompanySwitcher({
  className,
  currentCompanyId,
  companies,
  homeHref,
}: CompanySwitcherProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const selectedCompanyId =
    currentCompanyId && companies.some((company) => company.id === currentCompanyId)
      ? currentCompanyId
      : companies[0]?.id ?? "";
  const currentCompanyName =
    companies.find((company) => company.id === selectedCompanyId)?.name ?? "Acre";

  async function handleChange(nextCompanyId: string) {
    if (!nextCompanyId || nextCompanyId === selectedCompanyId || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/account/active-company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          officeId: nextCompanyId,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to switch company.");
      }

      startTransition(() => {
        router.push(homeHref);
        router.refresh();
      });
    } catch {
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <label
      className={`office-company-switcher office-company-switcher-select${className ? ` ${className}` : ""}`}
    >
      <span className="office-company-switcher-copy">
        <span>{t((messages) => messages.companySwitcher.label)}</span>
        <strong>{currentCompanyName}</strong>
      </span>
      <span aria-hidden="true" className="office-company-switcher-caret">
        ▾
      </span>
      <select
        aria-label={t((messages) => messages.companySwitcher.ariaLabel)}
        className="office-company-switcher-native-select"
        disabled={isSaving || companies.length === 0}
        onChange={(event) => void handleChange(event.target.value)}
        value={selectedCompanyId}
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </label>
  );
}
