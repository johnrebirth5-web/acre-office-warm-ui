import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStructuredFinancePayloadFromDraft,
  createTransactionFinanceCreateDraft,
  type TransactionFinanceCreateDraft
} from "./transaction-finance-create-fields";

function cloneDraft(): TransactionFinanceCreateDraft {
  return createTransactionFinanceCreateDraft();
}

test("new transaction finance draft does not submit placeholder fees by default", () => {
  const payload = buildStructuredFinancePayloadFromDraft(cloneDraft());

  assert.equal(payload.fees.length, 0);
});

test("company referral fee is ignored unless company referral is enabled", () => {
  const draft = cloneDraft();
  const companyReferralFee = draft.fees.find((fee) => fee.feeTypeValue === "company_referral");

  assert.ok(companyReferralFee);
  companyReferralFee.amount = "2000";

  const payload = buildStructuredFinancePayloadFromDraft(draft);

  assert.equal(payload.fees.some((fee) => fee.feeType === "company_referral"), false);
});

test("explicit fee values are preserved in the structured create payload", () => {
  const draft = cloneDraft();
  const clientReferralFee = draft.fees.find((fee) => fee.feeTypeValue === "client_referral");

  assert.ok(clientReferralFee);
  clientReferralFee.rate = "2";

  const payload = buildStructuredFinancePayloadFromDraft(draft);

  assert.deepEqual(payload.fees, [
    {
      feeType: "client_referral",
      rate: "2",
      amount: "",
      selectedCalculationType: "pre_split",
      notes: ""
    }
  ]);
});
