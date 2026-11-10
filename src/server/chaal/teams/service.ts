import "@tanstack/react-start/server-only";
import { readCommunityLimits } from "@/features/chaal/community/limits";
import {
	type ChaalTeamPage,
	type ChaalTeams,
	TEAM_MEMBERS_SHOWN,
	TEAM_TOURNAMENTS_SHOWN,
	type TeamJoinInput,
	type TeamSummary,
} from "@/features/chaal/teams/schema";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { log } from "@/server/log";
import { type ConnectDeps, requireFeature, withToken } from "../connect/service";
import type { ChaalPublic } from "../context";
import { teamTournaments } from "../events/service";
import { userLane } from "../lichess/lanes";
import { teamAnswer, teamMemberAnswer, teamPageAnswer, teamsOfAnswer } from "../lichess/schemas";
import { readAsViewer, viewerOf } from "../viewer";

/**
 * Teams (PLAN Task 83, decision 0273): popular teams and a search, a team with its newest
 * members and its tournaments, all public on the public lane through the cache (the `teams`
 * switch): the lists and a team a minute, its members ten. Whether the viewer is in a team,
 * the teams they're in, and joining or leaving use their token (`team:read`, `team:write`);
 * the admin may turn joining off while the pages stay.
 */

const MINUTE = 60_000;

const TTL = { popular: 10 * MINUTE, search: MINUTE, team: MINUTE, members: 10 * MINUTE } as const;

type Public = Pick<ChaalPublic, "cache" | "lichess" | "settings">;

/** The most popular teams, a page at a time. */
export async function popularTeams(chaal: Public, page: number): Promise<ChaalTeams> {
	requireFeature(chaal.settings, "teams");
	const path = "/api/team/all";
	const params = { page };
	return chaal.cache.read({ endpoint: "teams", path, params, epoch: chaal.settings.cacheEpoch }, TTL.popular, () =>
		chaal.lichess.json({ endpoint: "teams", path, params, lane: "public" }, teamPageAnswer),
	);
}

/** Teams whose names match. */
export async function searchTeams(chaal: Public, q: string, page: number): Promise<ChaalTeams> {
	requireFeature(chaal.settings, "teams");
	const path = "/api/team/search";
	const params = { text: q.trim().toLowerCase(), page };
	return chaal.cache.read({ endpoint: "team-search", path, params, epoch: chaal.settings.cacheEpoch }, TTL.search, () =>
		chaal.lichess.json({ endpoint: "team-search", path, params, lane: "public" }, teamPageAnswer),
	);
}

/**
 * A team: what it says about itself and its leaders, its newest members, its arenas and
 * Swiss tournaments, and for a connected viewer whether they're in it or have asked to be
 * (read with their token, never cached). NOT_FOUND when Lichess has no such team.
 */
export async function teamPage(chaal: ChaalPublic, session: Session | null, id: string): Promise<ChaalTeamPage> {
	requireFeature(chaal.settings, "teams");
	const epoch = chaal.settings.cacheEpoch;
	const path = `/api/team/${id}`;
	const viewer = await viewerOf(chaal, session);
	const own = await readAsViewer(chaal, viewer, "teams", (token, row) =>
		chaal.lichess.json({ endpoint: "team", path, token, lane: userLane(row.userId) }, teamAnswer),
	);
	const team =
		own ??
		(await chaal.cache.read({ endpoint: "team", path, epoch }, TTL.team, () =>
			chaal.lichess.json({ endpoint: "team", path, lane: "public" }, teamAnswer),
		));
	const membersPath = `${path}/users`;
	const [members, tournaments] = await Promise.all([
		chaal.cache
			.read({ endpoint: "team-members", path: membersPath, epoch }, TTL.members, () =>
				chaal.lichess.lines(
					{ endpoint: "team-members", path: membersPath, lane: "public" },
					teamMemberAnswer,
					TEAM_MEMBERS_SHOWN,
				),
			)
			.catch((error: unknown) => {
				log("warn", "chaal team members failed", { error: error instanceof Error ? error.message : "unknown" });
				return [];
			}),
		teamTournaments(chaal, team.id, TEAM_TOURNAMENTS_SHOWN),
	]);
	const { joined, requested, ...shown } = team;
	return {
		team: { ...shown, members, arenas: tournaments.arenas, swiss: tournaments.swiss },
		viewer: own ? { joined, requested } : null,
	};
}

/** The teams the player is in (Lichess wants a token to say). */
export function myTeams(deps: ConnectDeps, userId: string): Promise<TeamSummary[]> {
	return withToken(deps, userId, "teams", (token, row) =>
		deps.lichess.json(
			{ endpoint: "teams-of", path: `/api/team/of/${row.lichessId}`, token, lane: userLane(userId) },
			teamsOfAnswer,
		),
	);
}

/** Refuses joining and leaving while the admin has turned them off. */
async function requireJoining(deps: ConnectDeps) {
	if (!readCommunityLimits((await deps.controls.settings()).community).joinTeams)
		throw new AppError("FORBIDDEN", "Joining teams is off");
}

/** Joins a team, or asks to: a closed team's leaders read the message; a private one wants its password. */
export async function joinTeam(deps: ConnectDeps, userId: string, input: TeamJoinInput): Promise<void> {
	await requireJoining(deps);
	const form: Record<string, string> = {};
	if (input.message) form.message = input.message;
	if (input.password) form.password = input.password;
	await withToken(deps, userId, "teams", (token) =>
		deps.lichess.send({
			endpoint: "team-join",
			path: `/api/team/${input.id}/join`,
			method: "POST",
			form,
			token,
			lane: userLane(userId),
		}),
	);
}

/** Leaves a team. */
export async function leaveTeam(deps: ConnectDeps, userId: string, id: string): Promise<void> {
	await requireJoining(deps);
	await withToken(deps, userId, "teams", (token) =>
		deps.lichess.send({
			endpoint: "team-quit",
			path: `/api/team/${id}/quit`,
			method: "POST",
			token,
			lane: userLane(userId),
		}),
	);
}
