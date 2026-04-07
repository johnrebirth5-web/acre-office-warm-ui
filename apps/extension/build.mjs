import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");
const checkOnly = process.argv.includes("--check");
const sourceIcon = path.join(__dirname, "..", "web", "public", "acre-logo-nyr.png");

async function ensureFile(filePath) {
  await stat(filePath);
}

async function run() {
  await ensureFile(path.join(srcDir, "manifest.json"));
  await ensureFile(path.join(srcDir, "background.js"));
  await ensureFile(path.join(srcDir, "app-bridge.js"));
  await ensureFile(path.join(srcDir, "content.js"));
  await ensureFile(path.join(srcDir, "popup.html"));
  await ensureFile(path.join(srcDir, "popup.js"));
  await ensureFile(path.join(srcDir, "popup.css"));
  await ensureFile(sourceIcon);

  if (checkOnly) {
    return;
  }

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(srcDir, distDir, { recursive: true });
  await mkdir(path.join(distDir, "icons"), { recursive: true });
  await Promise.all([
    cp(sourceIcon, path.join(distDir, "icons", "icon16.png")),
    cp(sourceIcon, path.join(distDir, "icons", "icon32.png")),
    cp(sourceIcon, path.join(distDir, "icons", "icon48.png")),
    cp(sourceIcon, path.join(distDir, "icons", "icon128.png")),
  ]);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
