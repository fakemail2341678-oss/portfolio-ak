/**
 * `pnpm i18n:compile`: compiles the messages into src/paraglide, one module per locale, unless
 * they are already compiled from the same inputs (Part 9 Task 99, decision 0296).
 *
 *   pnpm i18n:compile            # only when a message, the settings or Paraglide changed
 *   pnpm i18n:compile --force    # always
 *
 * Compiling 7,227 messages with their type declarations takes 44 s, and `pnpm typecheck` did it on
 * every run: three quarters of a typecheck in which nothing had changed.
 *
 * Skipped only when all of these hold: the hash of the inputs is the one recorded by the last
 * compile here, and src/paraglide holds a per-locale build (a production build leaves one module
 * per message, which `pnpm dev` can't start on, decision 0198). The Vite plugin's own compiles
 * (dev, tests, builds) record nothing, so after a message changes the next run here compiles once.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const STAMP = "node_modules/.cache/paraglide/inputs-hash";
/** What a per-locale compile writes; missing after a production build or on a fresh clone. */
const OUTPUTS = ["src/paraglide/messages/en.js", "src/paraglide/messages.d.ts", "src/paraglide/runtime.js"];

function inputsHash() {
	const hash = createHash("sha256");
	const inputs = [
		...readdirSync("messages")
			.sort()
			.map((name) => `messages/${name}`),
		"project.inlang/settings.json",
		"project.inlang/paraglide.config.ts",
		"node_modules/@inlang/paraglide-js/package.json",
	];
	for (const file of inputs) hash.update(file).update(readFileSync(file));
	return hash.digest("hex");
}

const hash = inputsHash();
const fresh =
	!process.argv.includes("--force") &&
	OUTPUTS.every((file) => existsSync(file)) &&
	existsSync(STAMP) &&
	readFileSync(STAMP, "utf8") === hash;

if (!fresh) {
	// The CLI ignores the config's `outputStructure` (decision 0198), so it is passed here.
	const result = spawnSync(
		process.execPath,
		[
			"node_modules/@inlang/paraglide-js/bin/run.js",
			"compile",
			"--project",
			"./project.inlang",
			"--output-structure",
			"locale-modules",
			"--silent",
		],
		{ stdio: "inherit" },
	);
	if (result.status !== 0) process.exit(result.status ?? 1);
	mkdirSync("node_modules/.cache/paraglide", { recursive: true });
	writeFileSync(STAMP, hash);
}
