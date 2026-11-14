/**
 * Audit: every write the client makes (docs/PLAN.md 15.5 and 15.6): each `useMutation` and
 * `useCrudMutation` call, the mutation it uses, whether it is optimistic today, and the class
 * 15.6 gives the write.
 *
 *   node scripts/audit/writes.ts
 *
 * - **Optimistic today:** the mutation's options have `onMutate`, or it goes through
 *   `useCrudMutation` with `optimistic`, or a TanStack DB collection writes it.
 * - **The 15.6 class** is a guess from the names in the mutation (the server functions it calls):
 *   `credentials`, `irreversible` (cannot be undone, or leaves the app), `access` (shown at once,
 *   marked pending), else `optimistic`. Task 105 decides each one; this is where it starts.
 *
 * Prints counts and writes docs/history/part9-audit/writes.json.
 * Part 9 Task 98.
 */
import ts from "typescript";
import { calleeName, type Layer, layerOf, lineOf, parse, print, save, sourceFiles, tally, visit } from "./lib.ts";

type WriteClass = "credentials" | "irreversible" | "access" | "optimistic";

const CREDENTIALS =
	/authClient|signIn|signUp|signOut|password|twoFactor|totp|passkey|revokeSession|revokeOther|verifyEmail|changeEmail|oauth|backupCode/i;
const ACCESS = /role|permission|\bban|unban|block|suspend|reactivate|deactivate|impersonat|memberRole|setAccess/i;
const IRREVERSIBLE =
	/purge|deleteAccount|deleteUser|forget|send|resend|invite|remind|import|export|upload|cloudinary|lichess|tmdb|challenge|seek|resign|draw|takeback|abort|makeMove|playMove|berserk|joinTournament|withdraw|follow|probe|email/i;

const classify = (text: string, layer: Layer): WriteClass => {
	if (CREDENTIALS.test(text)) return "credentials";
	if (ACCESS.test(text)) return "access";
	// Chaal's writes are calls to Lichess for the user, unless they touch only our own tables.
	if (IRREVERSIBLE.test(text)) return "irreversible";
	if (layer === "chaal" && !/Preference|Setting|Curat|Featured|Announcement|Attempt|Local/i.test(text))
		return "irreversible";
	return "optimistic";
};

/** The imported server functions (and other callees) a mutation's text names, to say what it writes. */
const calls = (text: string) => [
	...new Set([...text.matchAll(/\b([a-z][A-Za-z0-9]+)\(\{\s*data\b/g)].map((match) => match[1] ?? "")),
];

type Definition = { id: string; file: string; line: number; optimistic: boolean; calls: string[]; text: string };
type CallSite = {
	file: string;
	line: number;
	layer: Layer;
	hook: "useMutation" | "useCrudMutation";
	/** The mutation the hook is given: `kharchaMutations.createPayment`, or `inline` for an object written in place. */
	mutation: string;
	optimistic: boolean;
	class: WriteClass;
	calls: string[];
};

const files = sourceFiles();

// Mutations defined once and used by name: every property of an object whose value builds
// `mutationOptions(…)`, and every function that returns it.
const definitions = new Map<string, Definition>();
for (const file of files) {
	const source = parse(file);
	if (!source.text.includes("mutationOptions")) continue;
	visit(source, (node) => {
		const named =
			(ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node)) && ts.isIdentifier(node.name)
				? node.name.text
				: ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
					? node.name.text
					: ts.isFunctionDeclaration(node) && node.name
						? node.name.text
						: undefined;
		if (!named) return;
		const text = node.getText(source);
		if (!/\bmutationOptions\(/.test(text)) return;
		// An object of mutations is not a mutation: its properties are.
		const value = ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node) ? node.initializer : undefined;
		if (value && ts.isObjectLiteralExpression(value)) return;
		const parent = node.parent?.parent;
		const owner =
			parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) ? `${parent.name.text}.` : "";
		const id = `${owner}${named}`;
		if (!definitions.has(id)) {
			definitions.set(id, {
				id,
				file,
				line: lineOf(source, node),
				optimistic: /\bonMutate\b/.test(text),
				calls: calls(text),
				text,
			});
		}
	});
}

const sites: CallSite[] = [];
for (const file of files) {
	if (file === "src/components/crud/use-crud-mutation.ts") continue;
	const source = parse(file);
	if (!/useMutation|useCrudMutation/.test(source.text)) continue;
	visit(source, (node) => {
		if (!ts.isCallExpression(node)) return;
		const hook = calleeName(node);
		if (hook !== "useMutation" && hook !== "useCrudMutation") return;
		const first = node.arguments[0];
		if (!first) return;
		const text = node.getText(source);
		const layer = layerOf(file);
		const reference = ts.isCallExpression(first) ? first.expression.getText(source) : first.getText(source);
		const definition = ts.isObjectLiteralExpression(first) ? undefined : definitions.get(reference);
		const whole = `${text} ${definition?.text ?? ""}`;
		const optimistic =
			hook === "useCrudMutation"
				? /\boptimistic\s*:/.test(text)
				: /\bonMutate\b/.test(text) || (definition?.optimistic ?? false);
		sites.push({
			file,
			line: lineOf(source, node),
			layer,
			hook,
			mutation: ts.isObjectLiteralExpression(first) ? "inline" : reference,
			optimistic,
			class: classify(whole, layer),
			calls: [...new Set([...calls(text), ...(definition?.calls ?? [])])],
		});
	});
}

// Writes that never pass through a mutation hook: a TanStack DB collection's own insert, update and delete.
const collectionWrites = files.flatMap((file) => {
	const source = parse(file);
	if (!/@tanstack\/(react-db|query-db-collection)|lib\/crud\/collection|use-crud-collection/.test(source.text))
		return [];
	const found: Array<{ file: string; line: number; layer: Layer; call: string }> = [];
	visit(source, (node) => {
		if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
		const method = node.expression.name.text;
		const target = node.expression.expression.getText(source);
		if (!["insert", "update", "delete"].includes(method)) return;
		if (!/rows|collection|notes|habits|tasks|cards/i.test(target)) return;
		found.push({ file, line: lineOf(source, node), layer: layerOf(file), call: `${target}.${method}` });
	});
	return found;
});

const share = (items: CallSite[]) => `${items.filter((item) => item.optimistic).length}/${items.length}`;
const byLayer = Object.fromEntries(
	[...new Set(sites.map((site) => site.layer))].map((layer) => [
		layer,
		share(sites.filter((site) => site.layer === layer)),
	]),
);
const wanted = sites.filter((site) => site.class === "optimistic");

print("Write call sites", {
	"useMutation calls": sites.filter((site) => site.hook === "useMutation").length,
	"useCrudMutation calls": sites.filter((site) => site.hook === "useCrudMutation").length,
	"files with either": new Set(sites.map((site) => site.file)).size,
	"mutations defined with mutationOptions": definitions.size,
	"collection writes (insert, update, delete)": collectionWrites.length,
});
print("Optimistic today, of all call sites, by layer", byLayer);
print("By hook", {
	useMutation: share(sites.filter((site) => site.hook === "useMutation")),
	useCrudMutation: share(sites.filter((site) => site.hook === "useCrudMutation")),
});
print(
	"The 15.6 class of each call site (a guess from its names)",
	tally(sites, (site) => site.class),
);
print("Call sites 15.6 wants optimistic", {
	"optimistic today": wanted.filter((site) => site.optimistic).length,
	"not yet": wanted.filter((site) => !site.optimistic).length,
});
print(
	"Not yet optimistic, by layer",
	tally(
		wanted.filter((site) => !site.optimistic),
		(site) => site.layer,
	),
);
print(
	"Collection writes by layer",
	tally(collectionWrites, (write) => write.layer),
);

save("writes", {
	generated: "node scripts/audit/writes.ts",
	callSites: sites.length,
	byHook: tally(sites, (site) => site.hook),
	optimisticByLayer: byLayer,
	classes: tally(sites, (site) => site.class),
	toMakeOptimistic: tally(
		wanted.filter((site) => !site.optimistic),
		(site) => site.layer,
	),
	definitions: [...definitions.values()].map(({ text: _text, ...rest }) => rest),
	sites,
	collectionWrites,
});
