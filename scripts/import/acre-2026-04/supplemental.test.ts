import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateSupplementalRows,
  buildSupplementalWorkbookExportUrl,
  extractMaxSupplementalSplitPercent,
  type SupplementalWorkbookRow,
} from "./supplemental.ts";

test("buildSupplementalWorkbookExportUrl normalizes Google edit URLs to workbook exports", () => {
  assert.equal(
    buildSupplementalWorkbookExportUrl(
      "https://docs.google.com/spreadsheets/d/abc123/edit?gid=0#gid=0",
    ),
    "https://docs.google.com/spreadsheets/d/abc123/export?format=xlsx",
  );
});

test("extractMaxSupplementalSplitPercent handles decimals, percentages, and mixed text", () => {
  assert.equal(extractMaxSupplementalSplitPercent("0.75"), 75);
  assert.equal(extractMaxSupplementalSplitPercent("75%"), 75);
  assert.equal(
    extractMaxSupplementalSplitPercent(
      "sales&rental 50%, From 1/23/2026 55%, From 3/31/2026 60%",
    ),
    60,
  );
  assert.equal(
    extractMaxSupplementalSplitPercent(
      "80%, $16,000 CAP, with a standard 30% referral fee to the company.",
    ),
    80,
  );
  assert.equal(
    extractMaxSupplementalSplitPercent("Only notes, no structured split"),
    null,
  );
});

test("aggregateSupplementalRows merges duplicates and preserves note context", () => {
  const rows: SupplementalWorkbookRow[] = [
    {
      sheetName: "Acre NY",
      officeSlug: "acre-ny-realty",
      sourceRowNumber: 10,
      userName: "Qiongxiu Zhang",
      licenseStateRaw: "NY",
      splitRaw: "0.3",
      expirationRaw: "",
    },
    {
      sheetName: "Acre NY",
      officeSlug: "acre-ny-realty",
      sourceRowNumber: 11,
      userName: "Qiongxiu Zhang",
      licenseStateRaw: "Acre Rental",
      splitRaw:
        "1/31/2025前30%，1/31/2025后40%，2/5/2025后50%，8/21/2025后持证60%",
      expirationRaw: "46619",
    },
  ];

  const aggregated = aggregateSupplementalRows(rows);
  const user = aggregated.aggregatedUsers[0];

  assert.ok(user);
  assert.equal(user.maxSplitPercent, 60);
  assert.equal(user.maxSplitPercentLabel, "60");
  assert.equal(user.licenseState, "Acre Rental");
  assert.equal(user.expirationDate, "2027-08-20");
  assert.deepEqual(user.licenseStateValues, ["NY", "Acre Rental"]);
  assert.equal(user.sourceRowNumbers.join(","), "10,11");
  assert.match(user.noteBlock, /Supplemental roster import: Acre NY/);
  assert.match(user.noteBlock, /Resolved max split: 60%/);
  assert.match(user.noteBlock, /Conflicting license states: NY \| Acre Rental/);
});
