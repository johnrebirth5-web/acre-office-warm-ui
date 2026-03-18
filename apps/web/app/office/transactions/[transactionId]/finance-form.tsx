"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@acre/ui";

type TransactionFinanceFormProps = {
  transactionId: string;
  grossCommission: string;
  referralFee: string;
  officeNet: string;
  agentNet: string;
  financeNotes: string;
  canAutoCalculateCommission?: boolean;
  readOnly?: boolean;
};

export function TransactionFinanceForm({
  transactionId,
  grossCommission,
  referralFee,
  officeNet,
  agentNet,
  financeNotes,
  canAutoCalculateCommission = false,
  readOnly = false
}: TransactionFinanceFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState({
    grossCommission,
    referralFee,
    officeNet,
    agentNet,
    financeNotes
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(name: keyof typeof formState, value: string) {
    setFormState((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSaveFinance() {
    setError("");
    setIsSaving(true);
    const shouldAutoCalculate = canAutoCalculateCommission && formState.grossCommission.trim().length > 0;
    let financeSaved = false;

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/finance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formState)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update finance.");
      }

      financeSaved = true;

      if (shouldAutoCalculate) {
        const calculateResponse = await fetch(`/api/office/transactions/${transactionId}/commissions/calculate`, {
          method: "POST"
        });

        if (!calculateResponse.ok) {
          const body = (await calculateResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Automatic commission recalculation failed.");
        }
      }

      router.refresh();
    } catch (saveError) {
      const fallbackMessage =
        financeSaved && shouldAutoCalculate
          ? "Finance saved, but automatic commission recalculation failed."
          : "Failed to update finance.";
      const detailMessage = saveError instanceof Error ? saveError.message : fallbackMessage;

      setError(financeSaved && shouldAutoCalculate ? `Finance saved. ${detailMessage}` : detailMessage);
    } finally {
      setIsSaving(false);
    }
  }

  const willAutoCalculate = canAutoCalculateCommission && formState.grossCommission.trim().length > 0;

  return (
    <div className="bm-transaction-finance-form">
      <label className="office-detail-field">
        <span>Gross commission</span>
        <input disabled={readOnly} onChange={(event) => updateField("grossCommission", event.target.value)} type="text" value={formState.grossCommission} />
      </label>
      <label className="office-detail-field">
        <span>Referral fee</span>
        <input disabled={readOnly} onChange={(event) => updateField("referralFee", event.target.value)} type="text" value={formState.referralFee} />
      </label>
      <label className="office-detail-field">
        <span>Office net</span>
        <input disabled={readOnly} onChange={(event) => updateField("officeNet", event.target.value)} type="text" value={formState.officeNet} />
      </label>
      <label className="office-detail-field">
        <span>Agent net</span>
        <input disabled={readOnly} onChange={(event) => updateField("agentNet", event.target.value)} type="text" value={formState.agentNet} />
      </label>
      <label className="office-detail-field office-detail-field-wide">
        <span>Finance notes</span>
        <textarea disabled={readOnly} onChange={(event) => updateField("financeNotes", event.target.value)} rows={3} value={formState.financeNotes} />
      </label>
      {readOnly ? <p className="office-form-helper">Financial details are read-only for your current access level.</p> : null}
      {!readOnly ? (
        <div className="office-form-actions">
          <Button disabled={isSaving} onClick={handleSaveFinance} type="button">
            {isSaving ? (willAutoCalculate ? "Saving & recalculating..." : "Saving...") : willAutoCalculate ? "Save finance & recalculate" : "Save finance"}
          </Button>
          {canAutoCalculateCommission ? (
            <p className="office-form-helper">Saving a Gross commission value will automatically recalculate commission for this transaction.</p>
          ) : null}
          {error ? <p className="bm-transaction-submit-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
