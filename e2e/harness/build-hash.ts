/**
 * A hash of everything the production build is made from, so the harness builds only when one of
 * them changed (Part 9 Task 99, decision 0296). The build took 94 s of every local e2e run, and
 * most reruns change a test, not the app.
 *
 * The hash is kept inside `.output/`: any other build (`pnpm build`, with a developer's own env)
 * empties that folder first, so its output is never mistaken for the harness's.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/** What `vite build` reads. Tests, docs, scripts and the harness itself are not in the build. */
const INPUTS = [
	"src",
	"public",
	"messages",
	"project.inlang",
	"vite",
	"vite.config.ts",
	"tsconfig.json",
	"package.json",
	"pnpm-lock.yaml",
	"components.json",
	// A developer's own VITE_ values, where the harness doesn't set them.
	".env",
];
/** Written by the build itself or by `pnpm install`: the same for the same inputs. */
const GENERATED = new Set(["src/paraglide", "src/routeTree.gen.ts", "public/chaal/engine", "project.inlang/cache"]);
const STAMP = ".output/.e2e-build-hash";

function buildHash(env: Record<string, string>) {
	const hash = createHash("sha256");
	const add = (file: string) => {
		const name = file.replaceAll(path.sep, "/");
		if (GENERATED.has(name)) return;
		const entries = readdirSync(file, { withFileTypes: true, encoding: "utf8" }).sort((a, b) =>
			a.name < b.name ? -1 : 1,
		);
		for (const entry of entries) {
			const child = path.join(file, entry.name);
			if (entry.isDirectory()) add(child);
			else if (!GENERATED.has(child.replaceAll(path.sep, "/"))) hash.update(child).update(readFileSync(child));
		}
	};
	for (const input of INPUTS) {
		if (!existsSync(input)) continue;
		if (statSync(input).isDirectory()) add(input);
		else hash.update(input).update(readFileSync(input));
	}
	// The public settings are compiled into the bundle.
	hash.update(JSON.stringify(Object.entries(env).sort()));
	return hash.digest("hex");
}

/** Whether `.output` is the harness's own build of the source as it is now; `stamp()` records that it is. */
export function buildCache(env: Record<string, string>) {
	const hash = buildHash(env);
	return {
		/** Of the source and the settings; the harness reports it at `/e2e/run`. */
		hash,
		fresh: existsSync(".output/server/index.mjs") && existsSync(STAMP) && readFileSync(STAMP, "utf8") === hash,
		stamp: () => writeFileSync(STAMP, hash),
	};
}
