import path from "node:path";
import { describe, expect, it } from "vitest";
import { findServerImportViolations, readSourceFiles } from "../utils/import-boundary";

const repoRoot = path.resolve(import.meta.dirname, "../..");

describe("server-only import boundary", () => {
	it("no client-reachable source file imports src/server", () => {
		const violations = findServerImportViolations(readSourceFiles(repoRoot));
		expect(violations).toEqual([]);
	});

	it("flags a client file that imports the server env (fixture)", () => {
		const fixture = new Map([
			["src/routes/leaky.tsx", `import { serverEnv } from "@/server/env";\nexport const x = serverEnv;`],
			["src/components/relative.tsx", `import "../server/env";`],
			["src/lib/dynamic.ts", `export const load = () => import("../server/env");`],
			["src/lib/reexport.ts", `export { serverEnv } from "@/server/env";`],
			["src/routes/db-leak.tsx", `import { db } from "@/server/db/client";`],
			// A .ts route with a component is a page, not a server route.
			[
				"src/routes/page.ts",
				`import { db } from "@/server/db/client";
export const Route = createFileRoute("/p")({ server: { handlers: {} }, component: P });`,
			],
		]);
		expect(findServerImportViolations(fixture)).toEqual([
			{ file: "src/routes/leaky.tsx", specifier: "@/server/env" },
			{ file: "src/components/relative.tsx", specifier: "../server/env" },
			{ file: "src/lib/dynamic.ts", specifier: "../server/env" },
			{ file: "src/lib/reexport.ts", specifier: "@/server/env" },
			{ file: "src/routes/db-leak.tsx", specifier: "@/server/db/client" },
			{ file: "src/routes/page.ts", specifier: "@/server/db/client" },
		]);
	});

	it("allows server code and server functions to import src/server (fixture)", () => {
		const fixture = new Map([
			["src/server/db/client.ts", `import { serverEnv } from "../env";`],
			["src/functions/health.ts", `import { serverEnv } from "@/server/env";`],
			["src/server.ts", `import "@/server/env";`],
			[
				"src/routes/sitemap[.]xml.ts",
				`import { db } from "@/server/db/client";
export const Route = createFileRoute("/sitemap.xml")({ server: { handlers: { GET } } });`,
			],
			["src/lib/client-only.ts", `import { clientEnv } from "@/lib/env/client";`],
		]);
		expect(findServerImportViolations(fixture)).toEqual([]);
	});

	it("vite config enforces the boundary with TanStack Start import protection", async () => {
		const { readFile } = await import("node:fs/promises");
		const config = await readFile(path.join(repoRoot, "vite.config.ts"), "utf8");
		expect(config).toContain('"**/src/server/**"');
		expect(config).toContain('"**/*.server.*"');
	});
});
