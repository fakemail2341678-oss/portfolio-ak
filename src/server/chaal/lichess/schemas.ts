import "@tanstack/react-start/server-only";
import { z } from "zod";
import type { ChaalEvent, ChaalEventChallenge, ChaalEventGame, ChaalEventPlayer } from "@/features/chaal/live/events";

/**
 * Lichess's answers, kept lean (PLAN 13.5): each schema reads only the fields Chaal uses
 * and maps them to its own shape, because the dehydrated state is in the page's HTML.
 * Unknown fields are dropped; a missing optional field becomes null.
 */

// --- OAuth and the account -------------------------------------------------------------

/** POST /api/token. */
export const tokenAnswer = z
	.object({ token_type: z.string(), access_token: z.string().regex(/^[A-Za-z0-9_]{1,512}$/), expires_in: z.number() })
	.transform((answer) => ({ token: answer.access_token, expiresInSeconds: answer.expires_in }));

/** GET /api/account. */
export const accountAnswer = z
	.object({
		id: z.string(),
		username: z.string(),
		title: z.string().nullish(),
		disabled: z.boolean().nullish(),
		tosViolation: z.boolean().nullish(),
	})
	.transform((account) => ({
		id: account.id.toLowerCase(),
		username: account.username,
		title: account.title ?? null,
		closed: account.disabled === true,
	}));
// --- The event stream (GET /api/stream/event) --------------------------------------------

const color = z.enum(["white", "black"]);

const gamePlayer = z
	.object({
		id: z.string().nullish(),
		username: z.string().nullish(),
		name: z.string().nullish(),
		title: z.string().nullish(),
		rating: z.number().nullish(),
		ai: z.number().nullish(),
	})
	.transform(
		(player): ChaalEventPlayer => ({
			id: player.id ?? null,
			name: player.username ?? player.name ?? (player.ai ? `Stockfish level ${player.ai}` : "?"),
			title: player.title ?? null,
			rating: player.rating ?? null,
			aiLevel: player.ai ?? null,
		}),
	);

const named = z.union([z.string(), z.object({ name: z.string().optional(), key: z.string().optional() })]);
const nameOf = (value: z.output<typeof named> | null | undefined, field: "name" | "key") =>
	typeof value === "string" ? value : (value?.[field] ?? value?.name ?? "");

const eventGame = z
	.object({
		gameId: z.string(),
		color,
		fen: z.string(),
		lastMove: z.string().nullish(),
		source: z.string().nullish(),
		status: named.nullish(),
		variant: named.nullish(),
		speed: z.string().nullish(),
		rated: z.boolean().nullish(),
		hasMoved: z.boolean().nullish(),
		isMyTurn: z.boolean().nullish(),
		secondsLeft: z.number().nullish(),
		opponent: gamePlayer,
		winner: color.nullish(),
		ratingDiff: z.number().nullish(),
		compat: z.object({ board: z.boolean().nullish() }).nullish(),
		tournamentId: z.string().nullish(),
	})
	.transform(
		(game): ChaalEventGame => ({
			id: game.gameId,
			color: game.color,
			fen: game.fen,
			lastMove: game.lastMove ?? "",
			source: game.source ?? "",
			status: nameOf(game.status, "name"),
			variant: nameOf(game.variant, "key"),
			speed: game.speed ?? "",
			rated: game.rated === true,
			hasMoved: game.hasMoved === true,
			isMyTurn: game.isMyTurn === true,
			secondsLeft: game.secondsLeft ?? null,
			opponent: game.opponent,
			winner: game.winner ?? null,
			ratingDiff: game.ratingDiff ?? null,
			boardCompatible: game.compat?.board !== false,
			tournamentId: game.tournamentId ?? null,
		}),
	);

const eventChallenge = z
	.object({
		id: z.string(),
		status: z.string().nullish(),
		challenger: gamePlayer.nullish(),
		destUser: gamePlayer.nullish(),
		variant: named.nullish(),
		rated: z.boolean().nullish(),
		speed: z.string().nullish(),
		timeControl: z
			.object({
				type: z.string(),
				limit: z.number().nullish(),
				increment: z.number().nullish(),
				daysPerTurn: z.number().nullish(),
			})
			.nullish(),
		color: z.string().nullish(),
		finalColor: color.nullish(),
		declineReasonKey: z.string().nullish(),
	})
	.transform(
		(challenge): ChaalEventChallenge => ({
			id: challenge.id,
			status: challenge.status ?? "",
			challenger: challenge.challenger ?? null,
			destUser: challenge.destUser ?? null,
			variant: nameOf(challenge.variant, "key"),
			rated: challenge.rated === true,
			speed: challenge.speed ?? "",
			timeControl: {
				type: challenge.timeControl?.type ?? "unlimited",
				limit: challenge.timeControl?.limit ?? null,
				increment: challenge.timeControl?.increment ?? null,
				daysPerTurn: challenge.timeControl?.daysPerTurn ?? null,
			},
			color: challenge.color ?? "random",
			finalColor: challenge.finalColor ?? null,
			declineReasonKey: challenge.declineReasonKey ?? null,
		}),
	);

const streamEvent = z.discriminatedUnion("type", [
	z.object({ type: z.enum(["gameStart", "gameFinish"]), game: eventGame }),
	z.object({ type: z.enum(["challenge", "challengeCanceled", "challengeDeclined"]), challenge: eventChallenge }),
]);

/**
 * One line of Lichess's event stream as Chaal's event, or null when it isn't one Chaal
 * knows (a new event type, or a shape that changed): those are dropped, never passed on.
 */
export function mapStreamEvent(value: unknown): ChaalEvent | null {
	const parsed = streamEvent.safeParse(value);
	return parsed.success ? parsed.data : null;
}

// --- Small public answers the lab reads ----------------------------------------------------

/** GET /api/puzzle/daily: the lab's public-lane check reads only the puzzle's id and rating. */
export const dailyPuzzleAnswer = z
	.object({ puzzle: z.object({ id: z.string(), rating: z.number().nullish() }) })
	.transform((answer) => ({ id: answer.puzzle.id, rating: answer.puzzle.rating ?? null }));
