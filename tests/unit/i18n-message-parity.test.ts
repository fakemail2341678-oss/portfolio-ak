import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const settings = JSON.parse(readFileSync(path.join(root, "project.inlang/settings.json"), "utf8")) as {
	baseLocale: string;
	locales: string[];
};

type Messages = Record<string, string>;

const load = (locale: string): Messages => {
	const { $schema: _schema, ...messages } = JSON.parse(
		readFileSync(path.join(root, "messages", `${locale}.json`), "utf8"),
	) as Messages;
	return messages;
};

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const base = load(settings.baseLocale);
const others = settings.locales.filter((locale) => locale !== settings.baseLocale);

describe("i18n message files", () => {
	it("configures exactly en (base) and ne", () => {
		expect(settings.baseLocale).toBe("en");
		expect([...settings.locales].sort()).toEqual(["en", "ne"]);
	});

	it.each(others)("%s has exactly the same keys as the base locale", (locale) => {
		expect(Object.keys(load(locale)).sort()).toEqual(Object.keys(base).sort());
	});

	it.each(settings.locales)("%s has no empty messages", (locale) => {
		const empty = Object.entries(load(locale)).filter(([, value]) => value.trim() === "");
		expect(empty).toEqual([]);
	});

	it.each(others)("%s uses the same placeholders as the base locale", (locale) => {
		const messages = load(locale);
		const mismatched = Object.keys(base).filter(
			(key) => JSON.stringify(placeholders(base[key] ?? "")) !== JSON.stringify(placeholders(messages[key] ?? "")),
		);
		expect(mismatched).toEqual([]);
	});

	it("ne messages are actually translated (not copied English), except endonyms and pure formats", () => {
		const ne = load("ne");
		const allowedIdentical = new Set(["language_en", "language_ne"]);
		// Pure formats ("{label}: {value}") have no words to translate.
		const wordless = (value: string) => !/\p{L}/u.test(value.replace(/\{\w+\}/g, ""));
		const untranslated = Object.keys(base).filter(
			(key) => !allowedIdentical.has(key) && !wordless(base[key] ?? "") && ne[key] === base[key],
		);
		expect(untranslated).toEqual([]);
	});
});
