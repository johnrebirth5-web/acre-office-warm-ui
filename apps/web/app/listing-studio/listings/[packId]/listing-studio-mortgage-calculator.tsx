"use client";

import { type FocusEvent, useEffect, useId, useState } from "react";
import { formatCurrency } from "../../../../lib/i18n/format";

type LabeledValue = {
  label: string;
  value: string;
};

type ListingStudioMortgageCalculatorProps = {
  facts: LabeledValue[];
  price: number | null;
  priceLabel: string;
  sourceFacts: LabeledValue[];
};

type DownPaymentEditSource = "amount" | "percent";

type MonthlyExpense = {
  amount: number | null;
  label: string;
};

const DEFAULT_DOWN_PAYMENT_PERCENT = 20;
const DEFAULT_INTEREST_RATE = 6.625;
const DEFAULT_TERM_YEARS = 30;
const HOME_PRICE_DISPLAY_MINIMUM = 50_000;
const LOAN_TERM_OPTIONS = [10, 15, 20, 25, 30];

function parseNumericInput(value: string) {
  const normalized = value.replace(/[^0-9.]+/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatWholeNumberInput(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatPercentInput(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value
    .toFixed(value % 1 === 0 ? 0 : value < 10 ? 3 : 2)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

function formatMoney(value: number) {
  return formatCurrency(value, "en-US", "USD", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

function parsePriceFallback(priceLabel: string) {
  return parseNumericInput(priceLabel) ?? 0;
}

function parseMonthlyExpenseValue(value: string) {
  const directMonthlyMatch = value.match(
    /\$?\s*([\d,.]+)(?:\s*\/\s*mo|\s*per\s*month|\s*monthly)?/i,
  );
  if (directMonthlyMatch?.[1]) {
    const parsed = Number(directMonthlyMatch[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return parseNumericInput(value);
}

function findMonthlyExpense(
  items: LabeledValue[],
  matcher: RegExp,
  fallbackLabel: string,
) {
  for (const item of items) {
    if (!matcher.test(item.label.toLowerCase())) {
      continue;
    }

    const normalizedLabel = item.label.toLowerCase();
    const nextLabel =
      fallbackLabel === "Common charges" && /hoa/.test(normalizedLabel)
        ? "HOA"
        : fallbackLabel === "Common charges" &&
            /maintenance/.test(normalizedLabel)
          ? "Maintenance"
          : fallbackLabel;

    return {
      amount: parseMonthlyExpenseValue(item.value),
      label: nextLabel,
    } satisfies MonthlyExpense;
  }

  return {
    amount: null,
    label: fallbackLabel,
  } satisfies MonthlyExpense;
}

function calculateMonthlyMortgagePayment(
  principal: number,
  annualInterestRate: number,
  loanTermYears: number,
) {
  if (principal <= 0 || loanTermYears <= 0) {
    return 0;
  }

  const monthlyInterestRate = annualInterestRate / 100 / 12;
  const paymentCount = loanTermYears * 12;

  if (monthlyInterestRate <= 0) {
    return principal / paymentCount;
  }

  const growthFactor = Math.pow(1 + monthlyInterestRate, paymentCount);
  return principal * monthlyInterestRate * (growthFactor / (growthFactor - 1));
}

function MortgageSummaryRow(props: {
  helperText?: string;
  isMuted?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`listing-studio-mortgage-summary-row${props.isMuted ? " is-muted" : ""}`}
    >
      <div>
        <strong>{props.label}</strong>
        {props.helperText ? <p>{props.helperText}</p> : null}
      </div>
      <span>{props.value}</span>
    </div>
  );
}

export function ListingStudioMortgageCalculator(
  props: ListingStudioMortgageCalculatorProps,
) {
  const combinedFacts = [...props.facts, ...props.sourceFacts];
  const commonCharges = findMonthlyExpense(
    combinedFacts,
    /common charges|hoa|maintenance/,
    "Common charges",
  );
  const taxes = findMonthlyExpense(combinedFacts, /tax/, "Taxes");
  const startingHomePrice =
    props.price && props.price > 0
      ? props.price
      : parsePriceFallback(props.priceLabel);
  const shouldRender =
    startingHomePrice >= HOME_PRICE_DISPLAY_MINIMUM ||
    commonCharges.amount !== null ||
    taxes.amount !== null;

  const dialogTitleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [homePriceInput, setHomePriceInput] = useState(() =>
    formatWholeNumberInput(startingHomePrice),
  );
  const [downPaymentAmountInput, setDownPaymentAmountInput] = useState(() =>
    formatWholeNumberInput(
      (startingHomePrice * DEFAULT_DOWN_PAYMENT_PERCENT) / 100,
    ),
  );
  const [downPaymentPercentInput, setDownPaymentPercentInput] = useState(() =>
    formatPercentInput(DEFAULT_DOWN_PAYMENT_PERCENT),
  );
  const [loanTermYearsInput, setLoanTermYearsInput] = useState(
    String(DEFAULT_TERM_YEARS),
  );
  const [interestRateInput, setInterestRateInput] = useState(() =>
    formatPercentInput(DEFAULT_INTEREST_RATE),
  );
  const [downPaymentEditSource, setDownPaymentEditSource] =
    useState<DownPaymentEditSource>("percent");

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    setHomePriceInput(formatWholeNumberInput(startingHomePrice));
    setDownPaymentAmountInput(
      formatWholeNumberInput(
        (startingHomePrice * DEFAULT_DOWN_PAYMENT_PERCENT) / 100,
      ),
    );
    setDownPaymentPercentInput(
      formatPercentInput(DEFAULT_DOWN_PAYMENT_PERCENT),
    );
    setLoanTermYearsInput(String(DEFAULT_TERM_YEARS));
    setInterestRateInput(formatPercentInput(DEFAULT_INTEREST_RATE));
    setDownPaymentEditSource("percent");
  }, [shouldRender, startingHomePrice]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!shouldRender) {
    return null;
  }

  const homePrice = Math.max(parseNumericInput(homePriceInput) ?? 0, 0);
  const downPaymentAmount = clamp(
    parseNumericInput(downPaymentAmountInput) ?? 0,
    0,
    homePrice,
  );
  const downPaymentPercent =
    homePrice > 0 ? clamp((downPaymentAmount / homePrice) * 100, 0, 100) : 0;
  const interestRate = Math.max(parseNumericInput(interestRateInput) ?? 0, 0);
  const loanTermYears = LOAN_TERM_OPTIONS.includes(Number(loanTermYearsInput))
    ? Number(loanTermYearsInput)
    : DEFAULT_TERM_YEARS;
  const mortgageAmount = Math.max(homePrice - downPaymentAmount, 0);
  const mortgagePayment = calculateMonthlyMortgagePayment(
    mortgageAmount,
    interestRate,
    loanTermYears,
  );
  const estimatedMonthlyPayment =
    mortgagePayment + (commonCharges.amount ?? 0) + (taxes.amount ?? 0);

  function handleHomePriceChange(rawValue: string) {
    const nextHomePrice = Math.max(parseNumericInput(rawValue) ?? 0, 0);
    setHomePriceInput(
      nextHomePrice > 0 ? formatWholeNumberInput(nextHomePrice) : "",
    );

    if (downPaymentEditSource === "amount") {
      const currentAmount = Math.max(
        parseNumericInput(downPaymentAmountInput) ?? 0,
        0,
      );
      const cappedAmount = clamp(currentAmount, 0, nextHomePrice);
      const nextPercent =
        nextHomePrice > 0 ? (cappedAmount / nextHomePrice) * 100 : 0;
      setDownPaymentAmountInput(
        cappedAmount > 0 ? formatWholeNumberInput(cappedAmount) : "",
      );
      setDownPaymentPercentInput(formatPercentInput(nextPercent));
      return;
    }

    const currentPercent = clamp(
      parseNumericInput(downPaymentPercentInput) ?? 0,
      0,
      100,
    );
    const nextAmount = (nextHomePrice * currentPercent) / 100;
    setDownPaymentPercentInput(formatPercentInput(currentPercent));
    setDownPaymentAmountInput(
      nextAmount > 0 ? formatWholeNumberInput(nextAmount) : "",
    );
  }

  function handleDownPaymentAmountChange(rawValue: string) {
    const nextAmount = clamp(parseNumericInput(rawValue) ?? 0, 0, homePrice);
    const nextPercent = homePrice > 0 ? (nextAmount / homePrice) * 100 : 0;

    setDownPaymentEditSource("amount");
    setDownPaymentAmountInput(
      nextAmount > 0 ? formatWholeNumberInput(nextAmount) : "",
    );
    setDownPaymentPercentInput(formatPercentInput(nextPercent));
  }

  function handleDownPaymentPercentChange(rawValue: string) {
    const nextPercent = clamp(parseNumericInput(rawValue) ?? 0, 0, 100);
    const nextAmount = (homePrice * nextPercent) / 100;

    setDownPaymentEditSource("percent");
    setDownPaymentPercentInput(
      rawValue.trim() ? formatPercentInput(nextPercent) : "",
    );
    setDownPaymentAmountInput(
      nextAmount > 0 ? formatWholeNumberInput(nextAmount) : "",
    );
  }

  function handleInterestRateChange(rawValue: string) {
    const nextRate = Math.max(parseNumericInput(rawValue) ?? 0, 0);
    setInterestRateInput(rawValue.trim() ? formatPercentInput(nextRate) : "");
  }

  function handleSelectAll(event: FocusEvent<HTMLInputElement>) {
    event.currentTarget.select();
  }

  return (
    <>
      <section
        aria-label="Monthly payment estimate"
        className="listing-studio-mortgage-callout"
      >
        <div className="listing-studio-mortgage-callout-copy">
          <span>Estimated monthly payment</span>
          <strong>{formatMoney(estimatedMonthlyPayment)}</strong>
          <p>
            Based on {formatPercentInput(downPaymentPercent)}% down, a{" "}
            {loanTermYears}-year loan, and {formatPercentInput(interestRate)}%
            interest. HOA, common charges, and taxes are included when available
            from the imported listing.
          </p>
        </div>

        <button
          className="listing-studio-mortgage-callout-button"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          Open calculator
        </button>
      </section>

      {isOpen ? (
        <div
          className="listing-studio-mortgage-modal-overlay"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <section
            aria-labelledby={dialogTitleId}
            aria-modal="true"
            className="listing-studio-mortgage-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="listing-studio-mortgage-modal-header">
              <h3 id={dialogTitleId}>Monthly payment calculator</h3>
              <button
                aria-label="Close monthly payment calculator"
                className="listing-studio-mortgage-modal-close"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                X
              </button>
            </header>

            <div className="listing-studio-mortgage-modal-body">
              <div className="listing-studio-mortgage-form-grid">
                <label className="listing-studio-mortgage-field">
                  <span>Home price</span>
                  <input
                    inputMode="numeric"
                    onChange={(event) =>
                      handleHomePriceChange(event.target.value)
                    }
                    onFocus={handleSelectAll}
                    placeholder="0"
                    type="text"
                    value={homePriceInput}
                  />
                </label>

                <div className="listing-studio-mortgage-field-row">
                  <label className="listing-studio-mortgage-field">
                    <span>Down payment</span>
                    <input
                      inputMode="numeric"
                      onChange={(event) =>
                        handleDownPaymentAmountChange(event.target.value)
                      }
                      onFocus={handleSelectAll}
                      placeholder="0"
                      type="text"
                      value={downPaymentAmountInput}
                    />
                  </label>

                  <label className="listing-studio-mortgage-field">
                    <span>Down payment %</span>
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        handleDownPaymentPercentChange(event.target.value)
                      }
                      onFocus={handleSelectAll}
                      placeholder="0"
                      type="text"
                      value={downPaymentPercentInput}
                    />
                  </label>
                </div>

                <label className="listing-studio-mortgage-field">
                  <span>Loan term</span>
                  <select
                    onChange={(event) =>
                      setLoanTermYearsInput(event.target.value)
                    }
                    value={loanTermYearsInput}
                  >
                    {LOAN_TERM_OPTIONS.map((term) => (
                      <option key={term} value={term}>
                        {term} years
                      </option>
                    ))}
                  </select>
                </label>

                <label className="listing-studio-mortgage-field">
                  <span>Interest rate</span>
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      handleInterestRateChange(event.target.value)
                    }
                    onFocus={handleSelectAll}
                    placeholder="0"
                    type="text"
                    value={interestRateInput}
                  />
                </label>
              </div>

              <div className="listing-studio-mortgage-summary-card">
                <MortgageSummaryRow
                  label="Mortgage amount"
                  value={formatMoney(mortgageAmount)}
                />
                <MortgageSummaryRow
                  label="Mortgage payment"
                  value={formatMoney(mortgagePayment)}
                />
                <MortgageSummaryRow
                  helperText="Monthly building fees carried from the imported listing facts."
                  isMuted={commonCharges.amount === null}
                  label={commonCharges.label}
                  value={
                    commonCharges.amount === null
                      ? "Not provided"
                      : formatMoney(commonCharges.amount)
                  }
                />
                <MortgageSummaryRow
                  helperText="Monthly property taxes captured from the source listing when available."
                  isMuted={taxes.amount === null}
                  label={taxes.label}
                  value={
                    taxes.amount === null
                      ? "Not provided"
                      : formatMoney(taxes.amount)
                  }
                />

                <div className="listing-studio-mortgage-disclaimer">
                  <p>
                    These figures are estimates for planning only. Mortgage
                    payment includes principal and interest. Insurance, closing
                    costs, utilities, and lender-specific fees are not included.
                  </p>
                  <p>
                    Adjust the rate, down payment, and loan term above to model
                    different monthly payment scenarios for this listing.
                  </p>
                </div>
              </div>
            </div>

            <footer className="listing-studio-mortgage-modal-footer">
              <div>
                <span>Estimated monthly payment</span>
                <strong>{formatMoney(estimatedMonthlyPayment)}</strong>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
