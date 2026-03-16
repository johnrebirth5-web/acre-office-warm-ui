import { spawn } from "node:child_process";

const port = process.env.PORT?.trim() || "3105";
const host = process.env.ACRE_DEV_HOST?.trim();
const args = ["run", "dev", "--workspace=@acre/web", "--", "--port", port];

if (host) {
  args.push("--hostname", host);
}

const child = spawn("npm", args, {
  stdio: "inherit",
  shell: true,
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
