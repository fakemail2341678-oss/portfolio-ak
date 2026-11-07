/**
 * The one event stream Parda's player understands (decision 0230). An adapter is the only
 * code per provider: it turns a provider's messages into these and says what the player can do.
 */

export type PardaSourceAdapter = "parda" | "viduki" | "none";

export type PlayerEvent =
	| { kind: "ready"; duration: number | null }
	| { kind: "position"; position: number; duration: number | null }
	| { kind: "play" }
	| { kind: "pause" }
	| { kind: "seeked"; position: number }
	| { kind: "ended" }
	| { kind: "failed"; reason: string };

export type PlayerCommand = { action: "play" } | { action: "pause" } | { action: "seek"; position: number };

/**
 * How a resume reaches the player: `param` fills `{start}`, `command` seeks after `ready`,
 * `self` is the player's own memory, and `none` can't resume.
 */
export type StartPosition = "param" | "command" | "self" | "none";

/** The title a player is showing: a provider that reports every title it remembers needs it to pick ours. */
export type PlayerTarget = {
	media: "movie" | "tv";
	id: number;
	season?: number | undefined;
	episode?: number | undefined;
};

export type PlayerAdapter = {
	id: string;
	startPosition: StartPosition;
	/** Null for a player that doesn't obey commands. */
	command: ((command: PlayerCommand) => unknown) | null;
	/**
	 * True when the player reports its position several times a second, so a position that
	 * stops moving means buffering (`stall.ts`). A slower report would read as constant stalls.
	 */
	infersStalls: boolean;
	/** The event a message means; null for anything else. Called for every message, so it returns early. */
	parse: (data: unknown, target: PlayerTarget | null) => PlayerEvent | null;
};
