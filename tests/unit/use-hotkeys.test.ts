import { describe, expect, it } from "vitest";
import { matchesHotkey } from "@/hooks/use-hotkeys";

const key = (init: Partial<KeyboardEventInit> & { key: string }) =>
	({
		key: init.key,
		ctrlKey: init.ctrlKey ?? false,
		metaKey: init.metaKey ?? false,
		altKey: init.altKey ?? false,
		shiftKey: init.shiftKey ?? false,
	}) as KeyboardEvent;

describe("matchesHotkey", () => {
	it("mod is Ctrl or ⌘, and nothing else may be held", () => {
		expect(matchesHotkey(key({ key: "k", ctrlKey: true }), "mod+k")).toBe(true);
		expect(matchesHotkey(key({ key: "K", metaKey: true }), "mod+k")).toBe(true);
		expect(matchesHotkey(key({ key: "k" }), "mod+k")).toBe(false);
		expect(matchesHotkey(key({ key: "k", ctrlKey: true, altKey: true }), "mod+k")).toBe(false);
		expect(matchesHotkey(key({ key: "k", ctrlKey: true, shiftKey: true }), "mod+k")).toBe(false);
	});

	it("plain keys don't fire with Ctrl or ⌘ held", () => {
		expect(matchesHotkey(key({ key: "escape" }), "escape")).toBe(true);
		expect(matchesHotkey(key({ key: "Escape" }), "escape")).toBe(true);
		expect(matchesHotkey(key({ key: "s", ctrlKey: true }), "s")).toBe(false);
	});

	it("symbols ignore Shift unless the combo names it", () => {
		expect(matchesHotkey(key({ key: "?", shiftKey: true }), "?")).toBe(true);
		expect(matchesHotkey(key({ key: "?", shiftKey: true }), "shift+?")).toBe(true);
		expect(matchesHotkey(key({ key: "A", shiftKey: true }), "shift+a")).toBe(true);
	});
});
