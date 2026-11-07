import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** All app and story source (generated Paraglide output excluded). */
function sourceText(): string {
	let text = "";
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "paraglide") walk(full);
			} else if (/\.(ts|tsx)$/.test(entry.name)) {
				text += readFileSync(full, "utf8");
			}
		}
	};
	walk(path.join(root, "src"));
	walk(path.join(root, ".storybook"));
	return text;
}

describe("i18n message usage", () => {
	it("every message is used somewhere (delete keys when their UI goes away)", () => {
		const { $schema: _schema, ...messages } = JSON.parse(
			readFileSync(path.join(root, "messages", "en.json"), "utf8"),
		) as Record<string, string>;
		const code = sourceText();
		const unused = Object.keys(messages).filter((key) => !new RegExp(`\\bm\\.${key}\\b`).test(code));
		expect(unused).toEqual([]);
	});
});
