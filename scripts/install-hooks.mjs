// `prepare` script: installs the git hooks from lefthook.yml.
// Skipped where there is no git checkout (Vercel builds, tarball installs) or in CI,
// so `pnpm install` never fails there.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.CI || !existsSync(".git")) process.exit(0);

const result = spawnSync("lefthook", ["install"], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
