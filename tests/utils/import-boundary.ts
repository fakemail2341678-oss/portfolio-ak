import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static check for the boundary rule in docs/PLAN.md:
 * code outside `src/server/`, `src/functions/` and `src/middleware/` must never import `src/server/`.
 * (Server functions may import it; the Start compiler strips their handlers from
 * the client bundle.) Checking direct imports is enough: any client-reachable file
 * that re-exports server code is itself scanned and flagged.
 */

export type SourceFiles = ReadonlyMap<string, string>;

export type Violation = { file: string; specifier: string };

const IMPORT_RE =
	/(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const toPosix = (p: string) => p.split(path.sep).join("/");

/** A server route: a .ts route file with only `server.handlers` (no component), stripped from the client. */
const isServerRoute = (file: string, source: string) =>
	file.startsWith("src/routes/") &&
	file.endsWith(".ts") &&
	/\bserver:\s*\{\s*handlers:/.test(source) &&
	!/\bcomponent:/.test(source);

// src/middleware may reach src/server only via dynamic import() inside .server(), which the
// Start compiler strips from client builds (TanStack import protection still checks the build).

const isAllowedImporter = (file: string, source: string) =>
	file.startsWith("src/server/") ||
	file.startsWith("src/functions/") ||
	file.startsWith("src/middleware/") ||
	// Server routes, e.g. the Better Auth API, /sitemap.xml, /robots.txt.
	isServerRoute(file, source) ||
	// Isomorphic helper whose server branch (createIsomorphicFn().server) is compiled out of the client.
	file === "src/lib/start/http-status.ts" ||
	// The server entry and its Sentry setup (imported only by src/server.ts).
	file === "src/server.ts" ||
	file === "src/instrument.server.ts";

/** Resolves an import specifier to a repo-relative path, or null for packages. */
const resolveSpecifier = (file: string, specifier: string): string | null => {
	if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
	if (specifier.startsWith("."))
		return toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
	return null;
};

const isServerPath = (resolved: string) => resolved === "src/server" || resolved.startsWith("src/server/");

export const findServerImportViolations = (files: SourceFiles): Violation[] => {
	const violations: Violation[] = [];
	for (const [file, source] of files) {
		if (isAllowedImporter(file, source)) continue;
		for (const match of source.matchAll(IMPORT_RE)) {
			const specifier = match[1] ?? match[2] ?? match[3];
			if (!specifier) continue;
			const resolved = resolveSpecifier(file, specifier);
			if (resolved && isServerPath(resolved)) violations.push({ file, specifier });
		}
	}
	return violations;
};

/** Reads every .ts/.tsx file under `src/`, keyed by repo-relative posix path. */
export const readSourceFiles = (repoRoot: string): SourceFiles => {
	const files = new Map<string, string>();
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (/\.(ts|tsx)$/.test(entry.name)) {
				files.set(toPosix(path.relative(repoRoot, full)), readFileSync(full, "utf8"));
			}
		}
	};
	walk(path.join(repoRoot, "src"));
	return files;
};
