import "@tanstack/react-start/server-only";
import { featureOn, missingScopes } from "@/features/chaal/features";
import {
	type ActivityDay,
	type ChaalCrosstable,
	type ChaalGameSummary,
	type ChaalLeaderboard,
	type ChaalPerfStats,
	type ChaalPlayerGames,
	type ChaalPlayerPage,
	type ChaalReplay,
	type FollowedPlayer,
	GAMES_PAGE_SIZE,
	LEADERBOARD_SIZE,
	type LeaderboardPerf,
	PLAYER_PERFS,
	type PlayerGamesInput,
	type PlayerPerf,
	type PlayerSuggestion,
	type PlayerViewer,
	type RatingSeries,
} from "@/features/chaal/players/schema";
import { isAppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { log } from "@/server/log";
import { exportedGame } from "../analysis/lichess";
import { type ChaalConnectionRow, connectionOf } from "../connect/repository";
import { type ConnectDeps, requireFeature, withToken } from "../connect/service";
import type { ChaalPublic } from "../context";
import { userLane } from "../lichess/lanes";
import {
	activityAnswer,
	autocompleteAnswer,
	crosstableAnswer,
	followedAnswer,
	gameLineAnswer,
	leaderboardAnswer,
	perfStatsAnswer,
	ratingHistoryAnswer,
	userAnswer,
	userStatusAnswer,
} from "../lichess/schemas";

/**
 * Players and games (PLAN Task 81, decision 0271). Everything here is public on Lichess and
 * read through the public lane and the cache (the `players` switch): leaderboards for an
 * hour, a profile and its status, a page of games and the crosstable for a minute, a
 * rating's history, details and the activity for ten minutes, a finished game for a day
 * (shared with importing it into analysis). What needs the viewer's token (whether they
 * follow someone, following and unfollowing, the players they follow) goes through
 * `withToken(…, "social", …)` on their lane and is never cached.
 */

const MINUTE = 60_000;

const TTL = {
	leaderboard: 60 * MINUTE,
	profile: MINUTE,
	details: 10 * MINUTE,
	games: MINUTE,
	search: MINUTE,
} as const;

/** How many games a page with a result filter looks through: Lichess can't filter by result. */
const RESULT_SCAN = GAMES_PAGE_SIZE * 3;

/** At most this many followed players are read. */
const FOLLOWING_MAX = 300;

const notFoundIsNull = <T>(call: Promise<T>): Promise<T | null> =>
	call.catch((error: unknown) => {
		if (isAppError(error) && error.code === "NOT_FOUND") return null;
		throw error;
	});

type Public = Pick<ChaalPublic, "cache" | "lichess" | "settings">;

export async function leaderboard(chaal: Public, perf: LeaderboardPerf): Promise<ChaalLeaderboard> {
	requireFeature(chaal.settings, "players");
	const path = `/api/player/top/${LEADERBOARD_SIZE}/${perf}`;
	return chaal.cache.read({ endpoint: "leaderboard", path, epoch: chaal.settings.cacheEpoch }, TTL.leaderboard, () =>
		chaal.lichess.json({ endpoint: "leaderboard", path, lane: "public" }, leaderboardAnswer(perf)),
	);
}

const userPath = (username: string) => `/api/user/${username.toLowerCase()}`;

function publicUser(chaal: Public, username: string) {
	const path = userPath(username);
	return chaal.cache.read({ endpoint: "user", path, epoch: chaal.settings.cacheEpoch }, TTL.profile, () =>
		chaal.lichess.json({ endpoint: "user", path, lane: "public" }, userAnswer),
	);
}

async function userStatus(chaal: Public, id: string) {
	const path = "/api/users/status";
	const params = { ids: id, withGameIds: true };
	const list = await chaal.cache.read(
		{ endpoint: "user-status", path, params, epoch: chaal.settings.cacheEpoch },
		TTL.profile,
		() => chaal.lichess.json({ endpoint: "user-status", path, params, lane: "public" }, userStatusAnswer),
	);
	return list.find((each) => each.id === id) ?? null;
}

/** A connection that may be used for a feature: there, not revoked, with its scopes, the feature on. */
function usable(chaal: ChaalPublic, row: ChaalConnectionRow | null, feature: "social"): row is ChaalConnectionRow {
	return Boolean(
		row &&
			!row.revokedAt &&
			!chaal.settings.maintenance &&
			featureOn(chaal.settings.features, feature) &&
			missingScopes(feature, row.scopes).length === 0,
	);
}

/**
 * A player's page: the profile, whether they're online or playing, and, for a viewer with
 * a connected account, whether they follow them and their score against them. NOT_FOUND
 * when Lichess has no such player.
 */
export async function playerPage(
	chaal: ChaalPublic,
	session: Session | null,
	username: string,
): Promise<ChaalPlayerPage> {
	requireFeature(chaal.settings, "players");
	const deps = session && chaal.connectConfigured ? await chaal.connectDeps() : null;
	const row = deps && session ? await connectionOf(deps.db, session.user.id) : null;
	const connected = row && !row.revokedAt ? row : null;

	let following: boolean | null = null;
	let read: Awaited<ReturnType<typeof publicUser>> | null = null;
	if (deps && session && usable(chaal, connected, "social") && connected.lichessId !== username.toLowerCase()) {
		// With the viewer's token Lichess says whether they follow this player; never cached.
		try {
			read = await withToken(deps, session.user.id, "social", (token) =>
				chaal.lichess.json(
					{ endpoint: "user", path: userPath(username), token, lane: userLane(session.user.id) },
					userAnswer,
				),
			);
			following = read.following ?? false;
		} catch (error) {
			if (!(isAppError(error) && error.reason === "lichess-reconnect")) throw error;
		}
	}
	const { player } = read ?? (await publicUser(chaal, username));
	if (!player.closed) {
		const status = await userStatus(chaal, player.id).catch((error: unknown) => {
			log("warn", "chaal player status failed", { code: isAppError(error) ? error.code : "unknown" });
			return null;
		});
		player.online = status?.online ?? player.online;
		player.playingId = status?.playingId ?? null;
	}

	let viewer: PlayerViewer | null = null;
	if (connected) {
		const self = connected.lichessId === player.id;
		viewer = {
			lichessId: connected.lichessId,
			username: connected.username,
			following: self ? null : following,
			crosstable: self || player.closed ? null : await crosstable(chaal, connected.lichessId, player.id),
		};
	}
	return { player, viewer };
}

/** The viewer's score against a player; null when Lichess can't say now. */
async function crosstable(chaal: Public, you: string, them: string): Promise<ChaalCrosstable | null> {
	const path = `/api/crosstable/${you}/${them}`;
	try {
		return await chaal.cache.read({ endpoint: "crosstable", path, epoch: chaal.settings.cacheEpoch }, TTL.games, () =>
			chaal.lichess.json({ endpoint: "crosstable", path, lane: "public" }, crosstableAnswer(you, them)),
		);
	} catch (error) {
		log("warn", "chaal crosstable failed", { code: isAppError(error) ? error.code : "unknown" });
		return null;
	}
}

/** A player's rating over time, standard chess only. */
export async function ratingHistory(chaal: Public, username: string): Promise<RatingSeries[]> {
	requireFeature(chaal.settings, "players");
	const path = `${userPath(username)}/rating-history`;
	return chaal.cache.read({ endpoint: "rating-history", path, epoch: chaal.settings.cacheEpoch }, TTL.details, () =>
		chaal.lichess.json({ endpoint: "rating-history", path, lane: "public" }, ratingHistoryAnswer),
	);
}

/** One rating's details; null when the player has none in it. */
export async function perfStats(chaal: Public, username: string, perf: PlayerPerf): Promise<ChaalPerfStats | null> {
	requireFeature(chaal.settings, "players");
	const path = `${userPath(username)}/perf/${perf}`;
	return chaal.cache.read({ endpoint: "perf", path, epoch: chaal.settings.cacheEpoch }, TTL.details, () =>
		notFoundIsNull(chaal.lichess.json({ endpoint: "perf", path, lane: "public" }, perfStatsAnswer(perf))),
	);
}

/** What a player did on their latest days, as Lichess counts it. */
export async function activity(chaal: Public, username: string): Promise<ActivityDay[]> {
	requireFeature(chaal.settings, "players");
	const path = `${userPath(username)}/activity`;
	return chaal.cache.read({ endpoint: "activity", path, epoch: chaal.settings.cacheEpoch }, TTL.details, () =>
		chaal.lichess.json({ endpoint: "activity", path, lane: "public" }, activityAnswer),
	);
}

const DAY_MS = 24 * 60 * MINUTE;
const dayStart = (day: string) => Date.parse(`${day}T00:00:00.000Z`);

/** Whether a game ended as `result` for the player. */
export function resultOf(game: ChaalGameSummary, playerId: string): "win" | "loss" | "draw" | null {
	if (game.ongoing || game.status === "aborted" || game.status === "noStart") return null;
	const side = game.white.id === playerId ? "white" : game.black.id === playerId ? "black" : null;
	if (!side) return null;
	if (!game.winner) return "draw";
	return game.winner === side ? "win" : "loss";
}

/**
 * The Lichess parameters for a page of games: standard chess's ratings unless one is
 * chosen, the dates as times (the "until" day included), the page's cursor, and the games
 * in progress on the first page only.
 */
export function gamesParams(input: PlayerGamesInput, max: number) {
	const untilDay = input.until ? dayStart(input.until) + DAY_MS - 1 : undefined;
	const until = [untilDay, input.before ? input.before - 1 : undefined].filter(
		(value): value is number => value !== undefined && Number.isFinite(value),
	);
	return {
		max,
		perfType: input.perf ?? PLAYER_PERFS.join(","),
		color: input.color,
		rated: input.rated,
		vs: input.vs?.toLowerCase(),
		since: input.since ? dayStart(input.since) : undefined,
		until: until.length > 0 ? Math.min(...until) : undefined,
		ongoing: input.before === undefined ? true : undefined,
		lastFen: true,
		opening: true,
		sort: "dateDesc",
	};
}

/** A page of a player's games, newest first, filtered as the URL says. */
export async function playerGames(chaal: Public, input: PlayerGamesInput): Promise<ChaalPlayerGames> {
	requireFeature(chaal.settings, "players");
	const scan = input.result ? RESULT_SCAN : GAMES_PAGE_SIZE;
	const params = gamesParams(input, scan);
	const path = `/api/games/user/${input.username.toLowerCase()}`;
	const games = await chaal.cache.read(
		{ endpoint: "games-user", path, params, epoch: chaal.settings.cacheEpoch },
		TTL.games,
		async () =>
			(await chaal.lichess.lines({ endpoint: "games-user", path, params, lane: "public" }, gameLineAnswer)).slice(
				0,
				scan,
			),
	);
	const more = games.length >= scan;
	if (!input.result) {
		const last = games.at(-1);
		return { games, next: more && last ? last.createdAt : null };
	}
	const id = input.username.toLowerCase();
	const kept: ChaalGameSummary[] = [];
	for (const game of games) {
		if (resultOf(game, id) !== input.result) continue;
		kept.push(game);
		// A full page: the next starts after this game, even if more matched behind it.
		if (kept.length === GAMES_PAGE_SIZE) return { games: kept, next: game.createdAt };
	}
	const last = games.at(-1);
	return { games: kept, next: more && last ? last.createdAt : null };
}

/** Players whose names start with `term`, for the palette. */
export async function searchPlayers(chaal: Public, term: string): Promise<PlayerSuggestion[]> {
	requireFeature(chaal.settings, "players");
	const path = "/api/player/autocomplete";
	const params = { term: term.toLowerCase(), object: true };
	return chaal.cache.read(
		{ endpoint: "autocomplete", path, params, epoch: chaal.settings.cacheEpoch },
		TTL.search,
		() => chaal.lichess.json({ endpoint: "autocomplete", path, params, lane: "public" }, autocompleteAnswer),
	);
}

/** A game to replay, or null when Lichess has no such game (an answer, so the page's first paint keeps it). */
export async function replay(chaal: Public, id: string): Promise<ChaalReplay | null> {
	requireFeature(chaal.settings, "players");
	const game = await exportedGame(chaal, id);
	if (!game) return null;
	const { finished: _finished, ...shown } = game;
	return shown;
}

/** The players the user follows on Lichess (`follow:read`). */
export function following(deps: ConnectDeps, userId: string): Promise<FollowedPlayer[]> {
	return withToken(deps, userId, "social", async (token) => {
		const list = await deps.lichess.lines(
			{ endpoint: "following", path: "/api/rel/following", token, lane: userLane(userId) },
			followedAnswer,
		);
		return list.slice(0, FOLLOWING_MAX).sort((a, b) => Number(b.online) - Number(a.online));
	});
}

/** Follows or unfollows a player on Lichess (`follow:write`). */
export function setFollowing(deps: ConnectDeps, userId: string, username: string, follow: boolean): Promise<void> {
	return withToken(deps, userId, "social", (token) =>
		deps.lichess.send({
			endpoint: follow ? "follow" : "unfollow",
			path: `/api/rel/${follow ? "follow" : "unfollow"}/${username.toLowerCase()}`,
			method: "POST",
			token,
			lane: userLane(userId),
		}),
	);
}
