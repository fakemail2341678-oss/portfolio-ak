import "@tanstack/react-start/server-only";
import { readCommunityLimits } from "@/features/chaal/community/limits";
import {
	type ArenaSummary,
	type ChaalArenaPage,
	type ChaalSwissPage,
	type ChaalTournaments,
	SWISS_STANDINGS,
	type SwissSummary,
	type TournamentJoinInput,
	type TournamentKind,
	type TournamentStatus,
} from "@/features/chaal/events/schema";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { log } from "@/server/log";
import { type ConnectDeps, requireFeature, withToken } from "../connect/service";
import type { ChaalPublic } from "../context";
import { userLane } from "../lichess/lanes";
import {
	arenaAnswer,
	arenaLineAnswer,
	swissAnswer,
	swissLineAnswer,
	swissResultAnswer,
	tournamentListAnswer,
} from "../lichess/schemas";
import { readAsViewer, viewerOf } from "../viewer";

/**
 * Tournaments (PLAN Task 83, decision 0273): Lichess's arenas and, through teams, its Swiss
 * tournaments. Public reads go on the public lane through the cache (the `tournaments`
 * switch): the list a minute (PLAN 13.5), an arena or a Swiss tournament ten seconds while
 * it's played, a minute before, ten minutes after. Where the viewer stands in an arena
 * Lichess says only to their token: that read is theirs and never cached. Joining and
 * withdrawing use their token (`tournament:write`), unless the admin turned joining off.
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

const TTL = {
	list: MINUTE,
	byStatus: { created: MINUTE, started: 10 * SECOND, finished: 10 * MINUTE } satisfies Record<TournamentStatus, number>,
	team: MINUTE,
} as const;

type Public = Pick<ChaalPublic, "cache" | "lichess" | "settings">;

/** Lichess's arenas: coming up, being played, just finished. */
export async function tournaments(chaal: Public): Promise<ChaalTournaments> {
	requireFeature(chaal.settings, "tournaments");
	const path = "/api/tournament";
	return chaal.cache.read({ endpoint: "tournaments", path, epoch: chaal.settings.cacheEpoch }, TTL.list, () =>
		chaal.lichess.json({ endpoint: "tournaments", path, lane: "public" }, tournamentListAnswer),
	);
}

/**
 * An arena with a page of its standings. With a connected viewer whose token may be used,
 * Lichess's answer says where they stand (`me`); otherwise the public one, cached. NOT_FOUND
 * when Lichess has no such arena.
 */
export async function arenaPage(
	chaal: ChaalPublic,
	session: Session | null,
	id: string,
	page: number,
): Promise<ChaalArenaPage> {
	requireFeature(chaal.settings, "tournaments");
	const path = `/api/tournament/${id}`;
	const params = { page };
	const viewer = await viewerOf(chaal, session);
	const own = await readAsViewer(chaal, viewer, "tournaments", (token, row) =>
		chaal.lichess.json({ endpoint: "arena", path, params, token, lane: userLane(row.userId) }, arenaAnswer),
	);
	const arena =
		own ??
		(await chaal.cache.read(
			{ endpoint: "arena", path, params, epoch: chaal.settings.cacheEpoch },
			(answer: { status: TournamentStatus }) => TTL.byStatus[answer.status],
			() => chaal.lichess.json({ endpoint: "arena", path, params, lane: "public" }, arenaAnswer),
		));
	return { arena, viewer: viewer ? { username: viewer.row.username } : null };
}

/**
 * A Swiss tournament and its first players. Lichess doesn't tell a token whether its player
 * joined, so the viewer's place is looked for in the standings read.
 */
export async function swissPage(chaal: ChaalPublic, session: Session | null, id: string): Promise<ChaalSwissPage> {
	requireFeature(chaal.settings, "tournaments");
	const epoch = chaal.settings.cacheEpoch;
	const path = `/api/swiss/${id}`;
	const swiss = await chaal.cache.read(
		{ endpoint: "swiss", path, epoch },
		(answer: { status: TournamentStatus }) => TTL.byStatus[answer.status],
		() => chaal.lichess.json({ endpoint: "swiss", path, lane: "public" }, swissAnswer),
	);
	const resultsPath = `${path}/results`;
	const params = { nb: SWISS_STANDINGS };
	const standings =
		swiss.nbPlayers === 0
			? []
			: await chaal.cache
					.read({ endpoint: "swiss-results", path: resultsPath, params, epoch }, TTL.byStatus[swiss.status], () =>
						chaal.lichess.lines(
							{ endpoint: "swiss-results", path: resultsPath, params, lane: "public" },
							swissResultAnswer,
							SWISS_STANDINGS,
						),
					)
					.catch((error: unknown) => {
						log("warn", "chaal swiss results failed", { error: error instanceof Error ? error.message : "unknown" });
						return [];
					});
	const viewer = await viewerOf(chaal, session);
	let shown: ChaalSwissPage["viewer"] = null;
	if (viewer) {
		const name = viewer.row.username.toLowerCase();
		const found = standings.some((player) => player.name.toLowerCase() === name);
		shown = { username: viewer.row.username, joined: found ? true : swiss.nbPlayers > standings.length ? null : false };
	}
	return { swiss: { ...swiss, standings }, viewer: shown };
}

/** A team's arenas and Swiss tournaments (the team page's lists): empty while tournaments are off, or when Lichess fails. */
export async function teamTournaments(
	chaal: Public,
	team: string,
	max: number,
): Promise<{ arenas: ArenaSummary[]; swiss: SwissSummary[] }> {
	if (chaal.settings.features.tournaments === false) return { arenas: [], swiss: [] };
	const epoch = chaal.settings.cacheEpoch;
	const params = { max };
	const failed = (kind: string) => (error: unknown) => {
		log("warn", "chaal team tournaments failed", { kind, error: error instanceof Error ? error.message : "unknown" });
		return [];
	};
	const arenaPath = `/api/team/${team}/arena`;
	const swissPath = `/api/team/${team}/swiss`;
	const [arenas, swiss] = await Promise.all([
		chaal.cache
			.read({ endpoint: "team-arena", path: arenaPath, params, epoch }, TTL.team, () =>
				chaal.lichess.lines({ endpoint: "team-arena", path: arenaPath, params, lane: "public" }, arenaLineAnswer, max),
			)
			.catch(failed("arena")),
		chaal.cache
			.read({ endpoint: "team-swiss", path: swissPath, params, epoch }, TTL.team, () =>
				chaal.lichess.lines({ endpoint: "team-swiss", path: swissPath, params, lane: "public" }, swissLineAnswer, max),
			)
			.catch(failed("swiss")),
	]);
	return { arenas, swiss };
}

const BASE: Record<TournamentKind, string> = { arena: "/api/tournament", swiss: "/api/swiss" };

/** Refuses joining and withdrawing while the admin has turned them off (the pages stay). */
async function requireJoining(deps: ConnectDeps) {
	if (!readCommunityLimits((await deps.controls.settings()).community).joinTournaments)
		throw new AppError("FORBIDDEN", "Joining tournaments is off");
}

/** Joins an arena (a password, a team for a team battle, "pair me ASAP") or a Swiss tournament (a password). */
export async function join(deps: ConnectDeps, userId: string, input: TournamentJoinInput): Promise<void> {
	await requireJoining(deps);
	const form: Record<string, string> = {};
	if (input.password) form.password = input.password;
	if (input.kind === "arena") {
		if (input.team) form.team = input.team;
		if (input.pairMeAsap) form.pairMeAsap = "true";
	}
	await withToken(deps, userId, "tournaments", (token) =>
		deps.lichess.send({
			endpoint: `${input.kind}-join`,
			path: `${BASE[input.kind]}/${input.id}/join`,
			method: "POST",
			form,
			token,
			lane: userLane(userId),
		}),
	);
}

/** Withdraws from an arena (pauses, as Lichess does) or a Swiss tournament. */
export async function withdraw(deps: ConnectDeps, userId: string, kind: TournamentKind, id: string): Promise<void> {
	await requireJoining(deps);
	await withToken(deps, userId, "tournaments", (token) =>
		deps.lichess.send({
			endpoint: `${kind}-withdraw`,
			path: `${BASE[kind]}/${id}/withdraw`,
			method: "POST",
			token,
			lane: userLane(userId),
		}),
	);
}
