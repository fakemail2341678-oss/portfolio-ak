/**
 * Before a dev server starts: messages compiled one module per locale, as dev uses them
 * (decision 0198). `pnpm build` leaves one module per message in src/paraglide; a dev
 * server started on those loads them while the Vite plugin rewrites them, and logs
 * "Failed to load url /src/paraglide/messages/<key>.js". When the per-locale file is
 * there this does nothing, so a normal start costs nothing.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export function ensureDevMessages(): void {
	if (existsSync("src/paraglide/messages/en.js")) return;
	console.log("[dev] compiling messages per locale (src/paraglide holds a production build's, or none)");
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
}

// `node scripts/lib/dev-messages.ts` (pnpm dev) runs it; dev-local and dev-offline import it.
if (import.meta.main) ensureDevMessages();
