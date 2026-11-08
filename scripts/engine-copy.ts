#!/usr/bin/env node
/**
 * pnpm engine:copy: copies Chaal's engine into public/chaal/engine/ (PLAN 13.5, "The
 * engine"; decisions 0257 and 0263). From the `stockfish` package (GPL-3.0) it takes the
 * lite single-threaded build only, `stockfish-19-lite-single.js` (28 KB) and its `.wasm`
 * (1.85 MB), unmodified, and the licence as COPYING.txt; the package's other builds (about
 * 200 MB) stay in node_modules. The copies are named with a hash of both files, so they
 * can be cached for a year; a file whose hash isn't ENGINE_HASH
 * (src/features/chaal/engine/files.ts) is refused, so a new package version is a
 * deliberate change there. The folder is gitignored.
 *
 * `chaalEngine()` is the Vite plugin that runs this before `vite dev` and `vite build`
 * (vite.config.ts), so a checkout, CI and Vercel need no extra step. It does nothing when
 * the copies are already there.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin } from "vite";
import {
	ENGINE_DIR,
	ENGINE_HASH,
	ENGINE_LICENCE,
	ENGINE_PACKAGE,
	ENGINE_SCRIPT,
	ENGINE_WASM,
} from "../src/features/chaal/engine/files.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const target = (served: string) => path.join(ROOT, "public", ...served.split("/").filter(Boolean));

/** Copies the engine when it isn't there yet; returns what it did. Throws on a package that isn't the expected one. */
export function copyEngine(): "copied" | "present" {
	const out = target(ENGINE_DIR);
	const wanted = [ENGINE_SCRIPT, ENGINE_WASM, ENGINE_LICENCE].map(target);
	if (wanted.every((file) => existsSync(file) && statSync(file).size > 0)) return "present";

	const require = createRequire(import.meta.url);
	// A literal, so knip sees the package used.
	const manifest = require.resolve("stockfish/package.json");
	const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { version?: string };
	if (pkg.version !== ENGINE_PACKAGE.version) {
		throw new Error(
			`engine-copy: ${ENGINE_PACKAGE.name} is ${pkg.version}, expected ${ENGINE_PACKAGE.version} (src/features/chaal/engine/files.ts)`,
		);
	}
	const dir = path.dirname(manifest);
	const script = path.join(dir, "bin", `${ENGINE_PACKAGE.build}.js`);
	const wasm = path.join(dir, "bin", `${ENGINE_PACKAGE.build}.wasm`);
	const hash = createHash("sha256").update(readFileSync(script)).update(readFileSync(wasm)).digest("hex").slice(0, 12);
	if (hash !== ENGINE_HASH) {
		throw new Error(`engine-copy: the engine's files hash to ${hash}, expected ${ENGINE_HASH}`);
	}

	mkdirSync(out, { recursive: true });
	// Older copies (another hash) go: only the current engine is served.
	const keep = new Set(wanted.map((file) => path.basename(file)));
	for (const name of readdirSync(out)) if (!keep.has(name)) rmSync(path.join(out, name), { force: true });
	copyFileSync(script, target(ENGINE_SCRIPT));
	copyFileSync(wasm, target(ENGINE_WASM));
	copyFileSync(path.join(dir, "Copying.txt"), target(ENGINE_LICENCE));
	return "copied";
}

/** Copies the engine before Vite serves or builds `public/`. */
export function chaalEngine(): Plugin {
	return {
		name: "chaal-engine",
		config() {
			copyEngine();
		},
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const result = copyEngine();
	console.log(`engine-copy: ${result} ${ENGINE_SCRIPT} and ${ENGINE_WASM}`);
}
