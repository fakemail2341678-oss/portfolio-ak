import { z } from "zod";
import type { PardaSourceAdapter, PlayerAdapter, PlayerEvent, PlayerTarget } from "./types";

/**
 * `parda`: Parda's own protocol, spoken by the placeholder player at /parda/api. A real
 * player can speak it directly, or gets its own adapter here. Messages to the parent are
 * `{ type: "parda.player", event: { name, position?, duration?, reason? } }`, and commands
 * are `{ type: "parda.command", action, position? }`.
 */
const pardaMessage = z.object({
	type: z.literal("parda.player"),
	event: z.object({
		name: z.enum(["ready", "position", "play", "pause", "seeked", "ended", "failed"]),
		position: z.number().nonnegative().optional(),
		duration: z.number().positive().optional(),
		reason: z.string().max(200).optional(),
	}),
});

const pardaAdapter: PlayerAdapter = {
	id: "parda",
	startPosition: "param",
	command: (command) => ({ type: "parda.command", ...command }),
	infersStalls: true,
	parse: (data) => {
		if (typeof data !== "object" || data === null || (data as { type?: unknown }).type !== "parda.player") return null;
		const message = pardaMessage.safeParse(data);
		if (!message.success) return null;
		const { name, position = 0, duration = null, reason = "unknown" } = message.data.event;
		switch (name) {
			case "ready":
				return { kind: "ready", duration };
			case "position":
				return { kind: "position", position, duration };
			case "seeked":
				return { kind: "seeked", position };
			case "failed":
				return { kind: "failed", reason };
			default:
				return { kind: name };
		}
	},
};

/**
 * `viduki`: the Viduki embed contract (decision 0248), which the owner's own API follows.
 * It reports two things and obeys nothing: `MEDIA_DATA` with the progress it keeps for
 * every title it has played (keyed by TMDB id; a series by `s{season}e{episode}`), and
 * `viduki:all-servers-failed` when every server behind it failed. No resume parameter or
 * command is documented, so it resumes from its own memory (`self`), and its reports
 * aren't frequent enough to infer buffering from.
 */
const vidukiProgress = z.object({ watched: z.number().nonnegative(), duration: z.number().nonnegative() });
const vidukiEntry = z.object({
	type: z.enum(["movie", "tv"]),
	progress: vidukiProgress.optional(),
	show_progress: z.record(z.string(), z.object({ progress: vidukiProgress })).optional(),
});
const vidukiFailure = z.object({
	type: z.literal("viduki:all-servers-failed"),
	stage: z.string().max(40).optional(),
	status: z.number().int().optional(),
});

function vidukiPosition(data: unknown, target: PlayerTarget | null): PlayerEvent | null {
	if (!target || typeof data !== "object" || data === null) return null;
	const entry = vidukiEntry.safeParse((data as Record<string, unknown>)[String(target.id)]);
	if (!entry.success || entry.data.type !== target.media) return null;
	const progress =
		target.media === "movie"
			? entry.data.progress
			: entry.data.show_progress?.[`s${target.season ?? 1}e${target.episode ?? 1}`]?.progress;
	if (!progress) return null;
	return { kind: "position", position: progress.watched, duration: progress.duration > 0 ? progress.duration : null };
}

const vidukiAdapter: PlayerAdapter = {
	id: "viduki",
	startPosition: "self",
	command: null,
	infersStalls: false,
	parse: (data, target) => {
		if (typeof data !== "object" || data === null) return null;
		const type = (data as { type?: unknown }).type;
		if (type === "MEDIA_DATA") return vidukiPosition((data as { data?: unknown }).data, target);
		if (type !== "viduki:all-servers-failed") return null;
		const failure = vidukiFailure.safeParse(data);
		if (!failure.success) return null;
		const { stage = "unknown", status } = failure.data;
		return { kind: "failed", reason: status === undefined ? stage : `${stage}:${status}` };
	},
};

/** A player that reports nothing: it never auto-falls back and isn't scored. */
const noneAdapter: PlayerAdapter = {
	id: "none",
	startPosition: "none",
	command: null,
	infersStalls: false,
	parse: () => null,
};

export const ADAPTERS: Readonly<Record<PardaSourceAdapter, PlayerAdapter>> = {
	parda: pardaAdapter,
	viduki: vidukiAdapter,
	none: noneAdapter,
};

/**
 * The event a window message means. It counts only when it comes from the source's own
 * frame and one of its origins (a relative template's origin is the page's), and when its
 * payload passes the adapter's parser. Anything else is ignored.
 */
export function acceptMessage(
	message: Pick<MessageEvent, "origin" | "source" | "data">,
	player: {
		adapter: PlayerAdapter;
		origins: ReadonlyArray<string>;
		frame: MessageEventSource | null;
		target: PlayerTarget | null;
	},
): PlayerEvent | null {
	if (!player.frame || message.source !== player.frame) return null;
	if (!player.origins.includes(message.origin)) return null;
	return player.adapter.parse(message.data, player.target);
}
