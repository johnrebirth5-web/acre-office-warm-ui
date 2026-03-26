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

  assert.equal(payload.companyReferral, "No");
  assert.equal(payload.fees.length, 0);
});

test("company referral amount enables the company referral payload automatically", () => {
  const draft = cloneDraft();
  draft.calculatorFields.companyReferral = "2000";

  const payload = buildStructuredFinancePayloadFromDraft(draft);

  assert.equal(payload.companyReferral, "Yes");
  assert.deepEqual(payload.fees, [
    {
      feeType: "company_referral",
      rate: "",
      amount: "2000",
      selectedCalculationType: "post_split",
      notes: ""
    }
  ]);
});

test("explicit calculator values are preserved in the structured create payload", () => {
  const draft = cloneDraft();
  draft.calculatorFields.clientReferral = "500";

  const payload = buildStructuredFinancePayloadFromDraft(draft);

  assert.deepEqual(payload.fees, [
    {
      feeType: "client_referral",
      rate: "",
      amount: "500",
      selectedCalculationType: "pre_split",
      notes: ""
    }
  ]);
});

test("zero-value fee entries are treated like empty optional fields", () => {
  const draft = cloneDraft();
  draft.calculatorFields.rebate = "0";

  const payload = buildStructuredFinancePayloadFromDraft(draft);

  assert.equal(payload.fees.length, 0);
});
