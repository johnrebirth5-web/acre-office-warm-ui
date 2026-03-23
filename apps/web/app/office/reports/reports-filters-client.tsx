"use client";

import { startTransition, useRef, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FilterField, SelectInput, TextInput } from "@acre/ui";
import type { OfficeTransactionReportsFilters } from "@acre/db";

type ReportsFiltersClientProps = {
  filters: OfficeTransactionReportsFilters;
};

function buildSearchParams(form: HTMLFormElement) {
  const formData = new FormData(form);
  const searchParams = new URLSearchParams();

  for (const [key, rawValue] of formData.entries()) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const value = rawValue.trim();

    if (!value) {
      continue;
    }

    searchParams.append(key, value);
  }

  return searchParams;
}

function MultiSelectField(props: {
  label: string;
  name: string;
  options: OfficeTransactionReportsFilters["ownerOptions"];
  defaultValue: string[];
  size?: number;
}) {
  return (
    <FilterField label={props.label}>
      <SelectInput defaultValue={props.defaultValue} multiple name={props.name} size={props.size ?? Math.min(4, Math.max(props.options.length, 2))}>
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectInput>
    </FilterField>
  );
}

function DateOperatorFields(props: {
  label: string;
  operatorName: string;
  valueName: string;
  fromName: string;
  toName: string;
  operatorValue: string;
  value: string;
  from: string;
  to: string;
}) {
  return (
    <>
      <FilterField label={`${props.label} operator`}>
        <SelectInput defaultValue={props.operatorValue} name={props.operatorName}>
          <option value="">Any</option>
          <option value="eq">Equals</option>
          <option value="gte">On or after</option>
          <option value="lte">On or before</option>
          <option value="range">Range</option>
        </SelectInput>
      </FilterField>
      <FilterField label={`${props.label} value`}>
        <TextInput defaultValue={props.value} name={props.valueName} type="date" />
      </FilterField>
      <FilterField label={`${props.label} from`}>
        <TextInput defaultValue={props.from} name={props.fromName} type="date" />
      </FilterField>
      <FilterField label={`${props.label} to`}>
        <TextInput defaultValue={props.to} name={props.toName} type="date" />
      </FilterField>
    </>
  );
}

function NumericOperatorFields(props: {
  label: string;
  operatorName: string;
  valueName: string;
  minName: string;
  maxName: string;
  operatorValue: string;
  value: string;
  min: string;
  max: string;
}) {
  return (
    <>
      <FilterField label={`${props.label} operator`}>
        <SelectInput defaultValue={props.operatorValue} name={props.operatorName}>
          <option value="">Any</option>
          <option value="eq">Equals</option>
          <option value="gt">Greater than</option>
          <option value="gte">Greater than or equal</option>
          <option value="lt">Less than</option>
          <option value="lte">Less than or equal</option>
          <option value="range">Range</option>
        </SelectInput>
      </FilterField>
      <FilterField label={`${props.label} value`}>
        <TextInput defaultValue={props.value} inputMode="decimal" name={props.valueName} placeholder="0.00" type="text" />
      </FilterField>
      <FilterField label={`${props.label} min`}>
        <TextInput defaultValue={props.min} inputMode="decimal" name={props.minName} placeholder="0.00" type="text" />
      </FilterField>
      <FilterField label={`${props.label} max`}>
        <TextInput defaultValue={props.max} inputMode="decimal" name={props.maxName} placeholder="0.00" type="text" />
      </FilterField>
    </>
  );
}

export function ReportsFiltersClient(props: ReportsFiltersClientProps) {
  const router = useRouter();
  const [isPending] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyFilters = () => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const searchParams = buildSearchParams(form);
    const href = searchParams.size ? `/office/reports?${searchParams.toString()}` : "/office/reports";

    startTransition(() => {
      router.replace(href);
    });
  };

  const scheduleApply = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      applyFilters();
    }, 250);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters();
  };

  return (
    <form
      ref={formRef}
      className="office-filter-bar office-list-filters office-report-filters"
      method="get"
      onChange={scheduleApply}
      onSubmit={handleSubmit}
    >
      <FilterField label="Owner">
        <SelectInput defaultValue={props.filters.ownerMembershipId} name="ownerMembershipId">
          <option value="">All owners</option>
          {props.filters.ownerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <DateOperatorFields
        from={props.filters.createdAtFrom}
        fromName="createdAtFrom"
        label="Creation Date"
        operatorName="createdAtOperator"
        operatorValue={props.filters.createdAtOperator}
        to={props.filters.createdAtTo}
        toName="createdAtTo"
        value={props.filters.createdAtValue}
        valueName="createdAtValue"
      />

      <FilterField label="Buyer / Tenant">
        <TextInput defaultValue={props.filters.buyerTenant} name="buyerTenant" placeholder="Buyer / Tenant" type="text" />
      </FilterField>

      <DateOperatorFields
        from={props.filters.closingMoveInFrom}
        fromName="closingMoveInFrom"
        label="Closing / Move-In"
        operatorName="closingMoveInOperator"
        operatorValue={props.filters.closingMoveInOperator}
        to={props.filters.closingMoveInTo}
        toName="closingMoveInTo"
        value={props.filters.closingMoveInValue}
        valueName="closingMoveInValue"
      />

      <NumericOperatorFields
        label="Commission"
        max={props.filters.commissionMax}
        maxName="commissionMax"
        min={props.filters.commissionMin}
        minName="commissionMin"
        operatorName="commissionOperator"
        operatorValue={props.filters.commissionOperator}
        value={props.filters.commissionValue}
        valueName="commissionValue"
      />

      <NumericOperatorFields
        label="Asking Price"
        max={props.filters.askingPriceMax}
        maxName="askingPriceMax"
        min={props.filters.askingPriceMin}
        minName="askingPriceMin"
        operatorName="askingPriceOperator"
        operatorValue={props.filters.askingPriceOperator}
        value={props.filters.askingPriceValue}
        valueName="askingPriceValue"
      />

      <NumericOperatorFields
        label="Purchased Price"
        max={props.filters.purchasedPriceMax}
        maxName="purchasedPriceMax"
        min={props.filters.purchasedPriceMin}
        minName="purchasedPriceMin"
        operatorName="purchasedPriceOperator"
        operatorValue={props.filters.purchasedPriceOperator}
        value={props.filters.purchasedPriceValue}
        valueName="purchasedPriceValue"
      />

      <MultiSelectField
        defaultValue={props.filters.transactionStatuses}
        label="Transaction Status"
        name="transactionStatuses"
        options={props.filters.statusOptions}
        size={3}
      />

      <FilterField label="Invoice Number">
        <TextInput defaultValue={props.filters.invoiceNumber} name="invoiceNumber" placeholder="Invoice Number" type="text" />
      </FilterField>

      <MultiSelectField
        defaultValue={props.filters.departmentIds}
        label="Department"
        name="departmentIds"
        options={props.filters.departmentOptions}
      />

      <MultiSelectField
        defaultValue={props.filters.teamLeaderMembershipIds}
        label="Team Leader"
        name="teamLeaderMembershipIds"
        options={props.filters.teamLeaderOptions}
      />

      <MultiSelectField
        defaultValue={props.filters.transactionTypes}
        label="Transaction Type"
        name="transactionTypes"
        options={props.filters.transactionTypeOptions}
      />

      <MultiSelectField
        defaultValue={props.filters.representingSides}
        label="Representing Side"
        name="representingSides"
        options={props.filters.representingOptions}
      />

      <MultiSelectField
        defaultValue={props.filters.layouts}
        label="Layout"
        name="layouts"
        options={props.filters.layoutOptions}
      />

      <FilterField label="Company Referral">
        <SelectInput defaultValue={props.filters.companyReferral} name="companyReferral">
          <option value="">Any</option>
          {props.filters.companyReferralOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Sort By">
        <SelectInput defaultValue={props.filters.sortBy} name="sortBy">
          <option value="created_at">Creation Date</option>
          <option value="asking_price">Asking Price</option>
          <option value="purchased_price">Purchased Price</option>
          <option value="gross_commission">Gross Commission</option>
          <option value="status">Status</option>
        </SelectInput>
      </FilterField>

      <FilterField label="Direction">
        <SelectInput defaultValue={props.filters.sortDirection} name="sortDirection">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </SelectInput>
      </FilterField>

      <div className="office-filter-actions">
        <Button disabled={isPending} type="submit">
          {isPending ? "Refreshing..." : "Apply filters"}
        </Button>
        <Button
          onClick={() => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            startTransition(() => {
              router.replace("/office/reports");
            });
          }}
          type="button"
          variant="secondary"
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
