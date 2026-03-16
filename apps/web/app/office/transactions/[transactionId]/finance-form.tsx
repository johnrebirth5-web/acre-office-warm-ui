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
  readOnly?: boolean;
};

export function TransactionFinanceForm({
  transactionId,
  grossCommission,
  referralFee,
  officeNet,
  agentNet,
  financeNotes,
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

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update finance.");
    } finally {
      setIsSaving(false);
    }
  }

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
            {isSaving ? "Saving..." : "Save finance"}
          </Button>
          {error ? <p className="bm-transaction-submit-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
