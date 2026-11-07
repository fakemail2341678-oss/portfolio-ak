import { describe, expect, it } from "vitest";
import { isDarkSquare, placementOf } from "@/features/chaal/board/fen";
import { connectionState } from "@/features/chaal/connect/use-connect";
import { DEFAULT_CHAAL_PREFERENCES, readPreferences } from "@/features/chaal/settings/preferences";

/** Chaal's preferences as stored (Task 73, decision 0259), the diagram's FEN reader and the connection's dot. */
describe("readPreferences", () => {
	it("keeps every valid value", () => {
		const stored = { ...DEFAULT_CHAAL_PREFERENCES, board: "stone", volume: 30, notation: "letters", zen: true };
		expect(readPreferences(stored)).toEqual(stored);
	});

	it("falls back field by field, so one stale value doesn't lose the rest", () => {
		expect(readPreferences({ board: "neon", volume: 140, sounds: false, extra: 1 })).toEqual({
			...DEFAULT_CHAAL_PREFERENCES,
			sounds: false,
		});
	});

	it("reads nothing usable as the defaults", () => {
		expect(readPreferences(null)).toEqual(DEFAULT_CHAAL_PREFERENCES);
		expect(readPreferences("diagram")).toEqual(DEFAULT_CHAAL_PREFERENCES);
	});
});

describe("placementOf", () => {
	it("reads the starting position", () => {
		const board = placementOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
		expect(board.size).toBe(32);
		expect(board.get("e1")).toBe("wK");
		expect(board.get("d8")).toBe("bQ");
		expect(board.get("e4")).toBeUndefined();
	});

	it("refuses a placement that isn't eight by eight", () => {
		expect(() => placementOf("8/8/8")).toThrow();
		expect(() => placementOf("rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toThrow();
		expect(() => placementOf("xnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toThrow();
	});

	it("colours a1 dark and h1 light", () => {
		expect(isDarkSquare(0, 1)).toBe(true);
		expect(isDarkSquare(7, 1)).toBe(false);
	});
});

describe("connectionState", () => {
	const connection = {
		lichessId: "p",
		username: "P",
		title: null,
		scopes: [],
		connectedAt: "2026-11-08T00:00:00.000Z",
		lastUsedAt: null,
		expiresAt: null,
		revoked: false,
		needsScopesFor: [],
	};

	it("is none without a connection, attention when it needs a reconnect, else ok", () => {
		expect(connectionState(null)).toBe("none");
		expect(connectionState(connection)).toBe("ok");
		expect(connectionState({ ...connection, revoked: true })).toBe("attention");
		expect(connectionState({ ...connection, needsScopesFor: ["play"] })).toBe("attention");
	});
});
