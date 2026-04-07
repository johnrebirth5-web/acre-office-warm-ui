import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");
const releaseDir = path.join(__dirname, "release");
const checkOnly = process.argv.includes("--check");
const packageOnly = process.argv.includes("--package");
const sourceIcon = path.join(__dirname, "..", "web", "public", "acre-logo-nyr.png");

async function ensureFile(filePath) {
  await stat(filePath);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function getManifestVersion() {
  const manifest = JSON.parse(
    await readFile(path.join(srcDir, "manifest.json"), "utf8"),
  );

  return manifest.version || "0.0.0";
}

async function createReleaseZip() {
  const version = await getManifestVersion();
  const zipName = `acre-listing-studio-extension-v${version}.zip`;
  const zipPath = path.join(releaseDir, zipName);

  await mkdir(releaseDir, { recursive: true });
  await rm(zipPath, { force: true });

  try {
    await runCommand("zip", ["-qr", zipPath, "."], { cwd: distDir });
  } catch (error) {
    if (process.platform === "darwin") {
      await runCommand("ditto", ["-c", "-k", "--sequesterRsrc", ".", zipPath], {
        cwd: distDir,
      });
    } else {
      throw error;
    }
  }

  console.log(`Created Chrome Web Store package: ${zipPath}`);
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

  if (packageOnly) {
    await createReleaseZip();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
