import { spawn } from "node:child_process";
import { unwatchFile, watchFile } from "node:fs";
import { resolve } from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nextBinPath = resolve(process.cwd(), "node_modules/next/dist/bin/next");
const port = process.env.PORT?.trim() || "3105";
const host = process.env.ACRE_DEV_HOST?.trim();
const schemaPath = resolve(process.cwd(), "packages/db/prisma/schema.prisma");
const shouldSkipInitialGenerate = process.env.ACRE_DEV_PRISMA_PREGENERATED === "1";
const nextArgs = [nextBinPath, "dev", "--port", port];

if (host) {
  nextArgs.push("--hostname", host);
}

let nextChild = null;
let isRestarting = false;
let isShuttingDown = false;
let queuedRestart = false;
let schemaChangeTimer = null;
let unexpectedRestartTimer = null;
let recentUnexpectedExitTimes = [];

function spawnNpm(args) {
  return spawn(npmCommand, args, {
    // Detached Docker compose runs without an interactive stdin. Letting
    // `next dev` inherit that EOF-prone stdin, or swapping it for `/dev/null`,
    // can make the dev server exit cleanly after the first compile. Give the
    // child an open pipe instead so stdin stays connected even in containers.
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env
  });
}

function spawnNextDev() {
  return spawn(process.execPath, nextArgs, {
    cwd: resolve(process.cwd(), "apps/web"),
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
  });
}

function runDbGenerate() {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawnNpm(["run", "db:generate"]);

    child.on("error", rejectPromise);
    child.on("exit", (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`db:generate exited with signal ${signal}`));
        return;
      }

      if ((code ?? 0) !== 0) {
        rejectPromise(new Error(`db:generate exited with code ${code ?? 0}`));
        return;
      }

      resolvePromise();
    });
  });
}

function stopNextChild() {
  return new Promise((resolvePromise) => {
    if (unexpectedRestartTimer) {
      clearTimeout(unexpectedRestartTimer);
      unexpectedRestartTimer = null;
    }

    if (!nextChild) {
      resolvePromise();
      return;
    }

    const child = nextChild;

    if (child.exitCode !== null || child.signalCode !== null) {
      if (nextChild === child) {
        nextChild = null;
      }

      resolvePromise();
      return;
    }

    const forceKillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 5000);

    child.once("exit", () => {
      clearTimeout(forceKillTimer);

      if (nextChild === child) {
        nextChild = null;
      }

      resolvePromise();
    });

    child.kill("SIGTERM");
  });
}

function recordUnexpectedExit() {
  const now = Date.now();
  recentUnexpectedExitTimes = [...recentUnexpectedExitTimes, now].filter(
    (timestamp) => now - timestamp <= 60_000,
  );
  return recentUnexpectedExitTimes.length;
}

function scheduleUnexpectedRestart(code, signal) {
  const recentExitCount = recordUnexpectedExit();
  const delayMs = Math.min(15_000, Math.max(1_000, recentExitCount * 2_000));
  const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;

  console.error(
    `[dev-web] Next dev exited unexpectedly with ${reason}. Restarting in ${Math.round(delayMs / 1000)}s...`,
  );

  if (unexpectedRestartTimer) {
    clearTimeout(unexpectedRestartTimer);
  }

  unexpectedRestartTimer = setTimeout(() => {
    unexpectedRestartTimer = null;

    if (isShuttingDown || isRestarting || nextChild) {
      return;
    }

    startNextChild();
  }, delayMs);
}

function startNextChild() {
  const child = spawnNextDev();
  nextChild = child;
  const startedAt = Date.now();

  child.on("exit", (code, signal) => {
    if (nextChild === child) {
      nextChild = null;
    }

    if (isRestarting || isShuttingDown) {
      return;
    }

    if (Date.now() - startedAt > 30_000) {
      recentUnexpectedExitTimes = [];
    }

    scheduleUnexpectedRestart(code, signal);
  });

  child.on("error", (error) => {
    if (isRestarting || isShuttingDown) {
      return;
    }

    console.error("[dev-web] Failed to spawn Next dev child process.");
    console.error(error);
    scheduleUnexpectedRestart(1, null);
  });
}

async function restartForSchemaChange(reason) {
  if (isShuttingDown) {
    return;
  }

  if (isRestarting) {
    queuedRestart = true;
    return;
  }

  isRestarting = true;

  try {
    console.log(`[dev-web] ${reason}; regenerating Prisma client and restarting Next dev...`);
    await stopNextChild();
    await runDbGenerate();

    if (!isShuttingDown) {
      startNextChild();
    }
  } catch (error) {
    console.error("[dev-web] Failed to refresh Prisma client after schema change.");
    console.error(error);
  } finally {
    isRestarting = false;

    if (queuedRestart && !isShuttingDown) {
      queuedRestart = false;
      void restartForSchemaChange("Detected another Prisma schema change");
    }
  }
}

function scheduleSchemaRefresh() {
  if (schemaChangeTimer) {
    clearTimeout(schemaChangeTimer);
  }

  schemaChangeTimer = setTimeout(() => {
    schemaChangeTimer = null;
    void restartForSchemaChange("Detected Prisma schema change");
  }, 150);
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  unwatchFile(schemaPath);

  if (schemaChangeTimer) {
    clearTimeout(schemaChangeTimer);
    schemaChangeTimer = null;
  }
  if (unexpectedRestartTimer) {
    clearTimeout(unexpectedRestartTimer);
    unexpectedRestartTimer = null;
  }

  await stopNextChild();

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(0);
}

watchFile(schemaPath, { interval: 1000 }, (current, previous) => {
  if (current.mtimeMs === previous.mtimeMs) {
    return;
  }

  scheduleSchemaRefresh();
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  if (!shouldSkipInitialGenerate) {
    console.log("[dev-web] Generating Prisma client before starting Next dev...");
    await runDbGenerate();
  }

  startNextChild();
} catch (error) {
  console.error("[dev-web] Failed to start dev server.");
  console.error(error);
  process.exit(1);
}
