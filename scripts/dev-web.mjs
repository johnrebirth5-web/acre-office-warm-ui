import { spawn } from "node:child_process";

const port = process.env.PORT?.trim() || "3105";
const child = spawn("npm", ["run", "dev", "--workspace=@acre/web", "--", "--port", port], {
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
