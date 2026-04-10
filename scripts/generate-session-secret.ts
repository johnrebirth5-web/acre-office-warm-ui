import { randomBytes } from "node:crypto";

function generateSessionSecret() {
  return randomBytes(32).toString("base64url");
}

const rotationRequested = process.argv.includes("--rotation") || process.argv.includes("--pair");
const primarySecret = generateSessionSecret();

console.log(`ACRE_SESSION_SECRET="${primarySecret}"`);

if (rotationRequested) {
  console.log(`ACRE_SESSION_SECRET_SECONDARY="${generateSessionSecret()}"`);
}
