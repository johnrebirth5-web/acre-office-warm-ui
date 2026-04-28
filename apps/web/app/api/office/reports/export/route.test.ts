import assert from "node:assert/strict";
import test from "node:test";
import { buildOfficeReportsCsvBody } from "./route";

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (inQuotes) {
      if (character === "\"") {
        if (line[index + 1] === "\"") {
          cell += "\"";
          index += 1;
          continue;
        }

        inQuotes = false;
        continue;
      }

      cell += character;
      continue;
    }

    if (character === "\"") {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += character;
  }

  cells.push(cell);
  return cells;
}

test("buildOfficeReportsCsvBody escapes headers with commas and quotes", () => {
  const csvBody = buildOfficeReportsCsvBody({
    columns: [
      {
        key: "aptSuiteFloor",
        label: "Unit # (If it's a house, fill out \"house\")"
      },
      {
        key: "city",
        label: "City"
      }
    ],
    rows: [
      {
        aptSuiteFloor: "palace",
        city: "lic"
      }
    ]
  } as never);
  const [headerLine, rowLine] = csvBody.split("\n");
  const headerCells = parseCsvLine(headerLine ?? "");
  const rowCells = parseCsvLine(rowLine ?? "");

  assert.equal(headerCells.length, 2);
  assert.equal(rowCells.length, 2);
  assert.deepEqual(headerCells, ["Unit # (If it's a house, fill out \"house\")", "City"]);
  assert.deepEqual(rowCells, ["palace", "lic"]);
  assert.match(headerLine ?? "", /^"Unit # \(If it's a house, fill out ""house""\)",City$/);
});
