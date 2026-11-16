import { AsyncLocalStorage } from "node:async_hooks";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ALL_PERMISSIONS } from "@/features/rbac/lib/permissions";
import { isAppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { errorNormalizationMiddleware } from "@/middleware/errors";
import { runInRequestScope } from "@/server/http/request-scope";

/**
 * The contract of every server function (PLAN Task 103, decision 0300), checked by calling
 * it: its real middleware chain runs (the guards, the validator, the error middleware of
 * src/start.ts) inside Start's request storage. The handler itself never runs: without
 * Start's compiler a function has no server body here, so nothing is written.
 *
 * - anonymous: UNAUTHORIZED, for every function whose first guard refuses (`require…`);
 * - a guest: UNAUTHORIZED, for every function that needs an account;
 * - the wrong role (no permissions): FORBIDDEN, for every `requirePermission`;
 * - bad input: VALIDATION with field errors, for every function with a validator;
 * - always the error envelope: an AppError carrying the request's id.
 *
 * The functions and their guards are read from the source the way the guard test reads it
 * (tests/server/functions-guards.test.ts), which checks each against its declared list.
 */

const getServerSession = vi.hoisted(() => vi.fn<() => Promise<Session | null>>());
vi.mock("@/server/auth/session", () => ({ getServerSession, forgetSession: () => {} }));
// Some guards read the database (Parda's viewer, Chaal's blocks): a migrated PGlite stands in.
vi.mock("@/server/db/client", async () => {
	const { createTestDb } = await import("../utils/test-db");
	return { db: (await createTestDb()).db };
});

const FUNCTIONS_DIR = join(process.cwd(), "src", "functions");

const functionFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "_lib" ? [] : functionFiles(path);
		return entry.name.endsWith(".ts") ? [path] : [];
	});

type Declared = { name: string; guards: string[]; validated: boolean };

/** Each `createServerFn` of a file: its name, its guards in order, and whether it validates input. */
const declared = (source: string): Declared[] =>
	[
		...source.matchAll(
			/export const (\w+) = createServerFn\(\{ method: "(?:GET|POST)" \}\)\s*\.middleware\(\[([\s\S]*?)\]\)(\s*\.validator\()?/g,
		),
	].map(([, name = "", list = "", validator]) => ({
		name,
		guards: list
			.split(/,(?![^(]*\))/)
			.map((guard) => guard.trim())
			.filter(Boolean),
		validated: Boolean(validator),
	}));

/** Guards that refuse an anonymous caller. `requireDev` refuses only in a production build. */
const refusesAnonymous = (guard: string) => guard.startsWith("require") && guard !== "requireDev";
/** Guards that need an account, not a guest's session (the core's; the products and the apps take guests). */
const ACCOUNT_GUARDS = /^(requireUser|requireAccountOwner|requireAdminAccess|requirePermission\()/;

const user = (overrides: Partial<Session["user"]> = {}): Session["user"] => ({
	id: "admin-1",
	email: "admin@example.com",
	name: "Admin",
	role: "admin",
	twoFactorEnabled: true,
	...overrides,
});
const ADMIN: Session = { user: user(), permissions: [...ALL_PERMISSIONS] };
const NO_ROLE: Session = { user: user({ id: "member-1", role: "user" }), permissions: [] };
const GUEST: Session = { user: user({ id: "guest-1", role: "user" }), permissions: [], isAnonymous: true };

type Runnable = { __executeServer: (options: { data: unknown; context: object }) => Promise<{ error?: unknown }> };
type Storage = AsyncLocalStorage<unknown>;

/** Start's two request storages (the event, the Start context), shared through globalThis by its packages. */
const storage = (key: string): Storage => {
	const global = globalThis as unknown as Record<symbol, Storage | undefined>;
	const symbol = Symbol.for(key);
	global[symbol] ??= new AsyncLocalStorage();
	return global[symbol];
};
const events = storage("tanstack-start:event-storage");
const starts = storage("tanstack-start:start-storage-context");

/** Calls a function as Start would, as `session`, and says what it threw and in which request. */
async function invoke(fn: Runnable, data: unknown, session: Session | null) {
	getServerSession.mockResolvedValue(session);
	const request = new Request("https://app.test/_serverFn/contract", { method: "POST" });
	let outcome: { error: unknown; requestId: string } = { error: undefined, requestId: "" };
	await runInRequestScope(async (requestId) => {
		const result = await events.run({ request, requestUrl: new URL(request.url) }, () =>
			starts.run(
				{
					request,
					startOptions: { functionMiddleware: [errorNormalizationMiddleware] },
					contextAfterGlobalMiddlewares: {},
					executedRequestMiddlewares: new Set(),
				},
				() => fn.__executeServer({ data, context: {} }),
			),
		);
		outcome = { error: result.error, requestId };
		return new Response();
	});
	return outcome;
}

/** What a refused call should have answered, or why it didn't. */
const mismatch = (outcome: { error: unknown; requestId: string }, code: string): string | null => {
	const { error, requestId } = outcome;
	if (!isAppError(error)) return `expected ${code}, got ${error === undefined ? "no error" : String(error)}`;
	if (error.code !== code) return `expected ${code}, got ${error.code}`;
	if (error.requestId !== requestId) return `${code} without the request's id`;
	return null;
};

/** Inputs no schema of ours takes: a number where an object or a string goes, then an unknown key. */
const BAD_INPUTS: unknown[] = [42, { __contract__: true }, [null]];

const files = functionFiles(FUNCTIONS_DIR);

/** How many of each check ran, so a parse that finds nothing can't pass. */
const ran = { functions: 0, anonymous: 0, guest: 0, noRole: 0, badInput: 0 };

describe("every server function's contract", () => {
	it("finds the functions", () => {
		expect(files.length).toBeGreaterThan(100);
	});

	for (const file of files) {
		const name = relative(FUNCTIONS_DIR, file).replaceAll("\\", "/");
		it(`${name}: refusals and bad input in the envelope`, { timeout: 60_000 }, async () => {
			vi.spyOn(console, "info").mockImplementation(() => {});
			vi.spyOn(console, "warn").mockImplementation(() => {});
			vi.spyOn(console, "error").mockImplementation(() => {});
			const module = (await import(/* @vite-ignore */ file)) as Record<string, Runnable>;
			const problems: string[] = [];
			for (const { name: fnName, guards, validated } of declared(readFileSync(file, "utf8"))) {
				const fn = module[fnName];
				if (!fn?.__executeServer) {
					problems.push(`${fnName}: not a server function`);
					continue;
				}
				const first = guards[0] ?? "";
				const note = (what: keyof typeof ran, result: string | null) => {
					ran[what] += 1;
					if (result) problems.push(`${fnName} (${what}): ${result}`);
				};
				ran.functions += 1;
				if (refusesAnonymous(first)) note("anonymous", mismatch(await invoke(fn, undefined, null), "UNAUTHORIZED"));
				if (ACCOUNT_GUARDS.test(first)) note("guest", mismatch(await invoke(fn, undefined, GUEST), "UNAUTHORIZED"));
				if (first.startsWith("requirePermission(") || first === "requireAdminAccess") {
					note("noRole", mismatch(await invoke(fn, undefined, NO_ROLE), "FORBIDDEN"));
				}
				if (validated) {
					let outcome = await invoke(fn, BAD_INPUTS[0], ADMIN);
					for (const input of BAD_INPUTS.slice(1)) {
						if (isAppError(outcome.error) && outcome.error.code === "VALIDATION") break;
						outcome = await invoke(fn, input, ADMIN);
					}
					const result = mismatch(outcome, "VALIDATION");
					const fields = isAppError(outcome.error) ? Object.keys(outcome.error.fieldErrors ?? {}) : [];
					note("badInput", result ?? (fields.length === 0 ? "VALIDATION without field errors" : null));
				}
			}
			expect(problems).toEqual([]);
		});
	}

	// Runs last: the counts of Task 103 (582 functions, 479 with a validator) less what moved since.
	it("checked every function", () => {
		expect(ran.functions).toBeGreaterThan(550);
		expect(ran.anonymous).toBeGreaterThan(400);
		expect(ran.guest).toBeGreaterThan(100);
		expect(ran.noRole).toBeGreaterThan(100);
		expect(ran.badInput).toBeGreaterThan(450);
	});
});
