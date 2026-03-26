"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, FilterField, ListPageFilters, SelectInput } from "@acre/ui";
import type { OfficePerformanceWorkspace } from "@acre/db";

type PerformanceFiltersClientProps = {
  filters: OfficePerformanceWorkspace["filters"];
};

type PerformanceFilterState = {
  period: OfficePerformanceWorkspace["filters"]["period"];
  company: OfficePerformanceWorkspace["filters"]["company"];
  year: string;
  month: string;
  quarter: string;
  yearStart: string;
  yearEnd: string;
};

function buildPerformanceHref(pathname: string, state: PerformanceFilterState) {
  const query = new URLSearchParams();

  query.set("period", state.period);
  query.set("company", state.company);
  query.set("year", state.year);
  query.set("month", state.month);
  query.set("quarter", state.quarter);
  query.set("yearStart", state.yearStart);
  query.set("yearEnd", state.yearEnd);

  return `${pathname}?${query.toString()}`;
}

function buildStateFromFilters(filters: OfficePerformanceWorkspace["filters"]): PerformanceFilterState {
  return {
    period: filters.period,
    company: filters.company,
    year: filters.year,
    month: filters.month,
    quarter: filters.quarter,
    yearStart: filters.yearStart,
    yearEnd: filters.yearEnd
  };
}

function buildDefaultState(filters: OfficePerformanceWorkspace["filters"]): PerformanceFilterState {
  return {
    period: filters.defaults.period,
    company: filters.defaults.company,
    year: filters.defaults.year,
    month: filters.defaults.month,
    quarter: filters.defaults.quarter,
    yearStart: filters.defaults.yearStart,
    yearEnd: filters.defaults.yearEnd
  };
}

export function PerformanceFiltersClient({ filters }: PerformanceFiltersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<PerformanceFilterState>(() => buildStateFromFilters(filters));

  useEffect(() => {
    setState(buildStateFromFilters(filters));
  }, [
    filters.company,
    filters.month,
    filters.period,
    filters.quarter,
    filters.year,
    filters.yearEnd,
    filters.yearStart
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(() => {
      router.push(buildPerformanceHref(pathname, state));
    });
  }

  function handleReset() {
    const nextState = buildDefaultState(filters);
    setState(nextState);

    startTransition(() => {
      router.push(buildPerformanceHref(pathname, nextState));
    });
  }

  return (
    <ListPageFilters as="form" className="office-performance-filter-bar" onSubmit={handleSubmit}>
      <FilterField label="View">
        <SelectInput
          onChange={(event) =>
            setState((current) => ({
              ...current,
              period: event.target.value as PerformanceFilterState["period"]
            }))
          }
          value={state.period}
        >
          {filters.periodOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Company">
        <SelectInput
          disabled={filters.companyOptions.length <= 1}
          onChange={(event) =>
            setState((current) => ({
              ...current,
              company: event.target.value as PerformanceFilterState["company"]
            }))
          }
          value={state.company}
        >
          {filters.companyOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Year">
        <SelectInput
          onChange={(event) =>
            setState((current) => ({
              ...current,
              year: event.target.value
            }))
          }
          value={state.year}
        >
          {filters.yearOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Month rank basis">
        <SelectInput
          onChange={(event) =>
            setState((current) => ({
              ...current,
              month: event.target.value
            }))
          }
          value={state.month}
        >
          {filters.monthOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <FilterField label="Quarter rank basis">
        <SelectInput
          onChange={(event) =>
            setState((current) => ({
              ...current,
              quarter: event.target.value
            }))
          }
          value={state.quarter}
        >
          {filters.quarterOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      {state.period === "year" ? (
        <>
          <FilterField label="Year table start">
            <SelectInput
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  yearStart: event.target.value
                }))
              }
              value={state.yearStart}
            >
              {filters.yearOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>

          <FilterField label="Year table end">
            <SelectInput
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  yearEnd: event.target.value
                }))
              }
              value={state.yearEnd}
            >
              {filters.yearOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FilterField>
        </>
      ) : null}

      <Button disabled={isPending} type="submit">
        {isPending ? "Applying..." : "Apply"}
      </Button>
      <Button disabled={isPending} onClick={handleReset} type="button" variant="secondary">
        Reset
      </Button>
    </ListPageFilters>
  );
}
