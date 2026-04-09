#!/usr/bin/env tsx

import {
  buildFrontOfficeCleanupDigestDeliveryDraft,
  buildFrontOfficeCleanupDigest,
  renderFrontOfficeCleanupDigestDeliveryDraft,
} from "../packages/db/src/front-office-cleanup-digest.ts";

type CliOptions = {
  organizationId?: string;
  membershipId?: string;
  officeId?: string;
  timeZone?: string;
  json?: boolean;
  now?: string;
};

function readCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--json") {
      options.json = true;
      continue;
    }

    if (value === "--organization-id") {
      options.organizationId = argv[++index]?.trim();
      continue;
    }

    if (value === "--membership-id") {
      options.membershipId = argv[++index]?.trim();
      continue;
    }

    if (value === "--office-id") {
      options.officeId = argv[++index]?.trim();
      continue;
    }

    if (value === "--time-zone") {
      options.timeZone = argv[++index]?.trim();
      continue;
    }

    if (value === "--now") {
      options.now = argv[++index]?.trim();
      continue;
    }
  }

  return options;
}

function readFallbackOption(
  cliValue: string | undefined,
  envValue: string | undefined,
) {
  const normalizedCliValue = cliValue?.trim();
  if (normalizedCliValue) {
    return normalizedCliValue;
  }

  const normalizedEnvValue = envValue?.trim();
  return normalizedEnvValue && normalizedEnvValue.length > 0
    ? normalizedEnvValue
    : undefined;
}

function printUsage() {
  console.error(
    [
      "Usage:",
      "  npx tsx scripts/front-office-cleanup-digest.ts --organization-id <id> --membership-id <id> [--office-id <id>] [--time-zone <iana>] [--now <iso>] [--json]",
      "",
      "Environment fallbacks:",
      "  ACRE_ORGANIZATION_ID, ACRE_MEMBERSHIP_ID, ACRE_OFFICE_ID, ACRE_TIME_ZONE",
    ].join("\n"),
  );
}

async function main() {
  const cliOptions = readCliOptions(process.argv.slice(2));
  const organizationId = readFallbackOption(
    cliOptions.organizationId,
    process.env.ACRE_ORGANIZATION_ID,
  );
  const membershipId = readFallbackOption(
    cliOptions.membershipId,
    process.env.ACRE_MEMBERSHIP_ID,
  );
  const officeId = readFallbackOption(
    cliOptions.officeId,
    process.env.ACRE_OFFICE_ID,
  );
  const timeZone = readFallbackOption(
    cliOptions.timeZone,
    process.env.ACRE_TIME_ZONE,
  );

  if (!organizationId || !membershipId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const digest = await buildFrontOfficeCleanupDigest({
    organizationId,
    viewerMembershipId: membershipId,
    officeId,
    timeZone,
    now: cliOptions.now ? new Date(cliOptions.now) : undefined,
  });
  const deliveryDraft = buildFrontOfficeCleanupDigestDeliveryDraft(digest);

  if (cliOptions.json) {
    console.log(JSON.stringify(deliveryDraft, null, 2));
    return;
  }

  console.log(renderFrontOfficeCleanupDigestDeliveryDraft(deliveryDraft));
}

void main().catch((error) => {
  console.error("[front-office-cleanup-digest] Failed to build digest.");
  console.error(error);
  process.exitCode = 1;
});
