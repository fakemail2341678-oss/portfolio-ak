import { readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import type { ChaalPublic } from "@/server/chaal/context";
import { type ChaalSettingsRow, createChaalControls, DEFAULT_CHAAL_SETTINGS } from "@/server/chaal/controls";
import * as events from "@/server/chaal/events/service";
import { createChaalCache } from "@/server/chaal/lichess/cache";
import { createLichess } from "@/server/chaal/lichess/client";
import { tournamentListAnswer } from "@/server/chaal/lichess/schemas";
import * as studies from "@/server/chaal/studies/service";
import * as teams from "@/server/chaal/teams/service";
import * as schema from "@/server/db/schema";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";
import { createTestDb } from "../utils/test-db";

/**
 * Community on the server (PLAN Task 83, decision 0273): the arenas' list and an arena
 * through the public lane and the cache (each TTL as the plan sets it), where a connected
 * viewer stands (their token, never cached), a Swiss tournament with its standings and the
 * viewer's place in them, a team with its newest members and tournaments, an account's
 * studies and a study read into chapters (a viewer's own read kept apart), and what joining,
 * leaving and saving send Lichess.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;
const API = "https://lichess.test";
const TEAM = "lichess-swiss";
let now = 1_000_000;

type Call = { method: string; url: URL; token: string | null; body: string | null };
const calls: Call[] = [];

const recorded = (url: URL) => {
	const name = lichessFixtureName("api", url.pathname, url.searchParams);
	return readLichessFixture(name) ?? readLichessFixture(name.replace(/\.json$/, ".ndjson"));
};

const fetcher = vi.fn<typeof fetch>(async (input, init) => {
	const url = new URL(String(input));
	const token = (init?.headers as Record<string, string>).authorization?.replace("Bearer ", "") ?? null;
	const method = init?.method ?? "GET";
	calls.push({ method, url, token, body: typeof init?.body === "string" ? init.body : null });
	if (method === "POST" && url.pathname.endsWith("/import-pgn"))
		return Response.json({ chapters: [{ id: "newCHAP1" }] });
	if (method === "POST") return Response.json({ ok: true });
	if (url.pathname.startsWith("/api/team/of/"))
		return Response.json([JSON.parse(recorded(new URL(`${API}/api/team/${TEAM}`)) ?? "{}")]);
	const body = recorded(url);
	// An account with no studies recorded has none.
	if (body === undefined && url.pathname.startsWith("/api/study/by/")) return new Response("");
	if (body === undefined) return Response.json({ error: "Not found" }, { status: 404 });
	// What Lichess says only to a player's token.
	if (token && url.pathname.startsWith("/api/tournament/"))
		return Response.json({ ...(JSON.parse(body) as object), me: { rank: 7, withdraw: false } });
	if (token && url.pathname === `/api/team/${TEAM}`)
		return Response.json({ ...(JSON.parse(body) as object), joined: true });
	return new Response(body, { status: 200 });
});

const lichess = () =>
	createLichess({ apiBase: API, explorerBase: API, tablebaseBase: API, userAgent: "t" }, fetcher, { now: () => now });
const deps = () => ({ db: env.db, lichess: lichess(), vault, controls: createChaalControls(env.db, () => 0) });

function chaal(settings: Partial<ChaalSettingsRow> = {}): ChaalPublic {
	const shared = deps();
	return {
		lichess: shared.lichess,
		cache: createChaalCache({ now: () => now }),
		controls: shared.controls,
		settings: { ...DEFAULT_CHAAL_SETTINGS, ...settings },
		appToken: null,
		connectConfigured: true,
		connectDeps: async () => shared,
	};
}

const session = (id: string): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
});

const ALL = ["tournament:write", "team:read", "team:write", "study:read", "study:write"];

async function connect(userId: string, scopes = ALL, username = `${userId}_li`) {
	await env.db.insert(schema.chConnection).values({
		userId,
		lichessId: username.toLowerCase(),
		username,
		token: await vault.seal(`lio_${userId}`, "token"),
		scopes,
	});
}

const list = tournamentListAnswer.parse(JSON.parse(readLichessFixture("api_tournament.json") ?? "{}"));
const finished = list.finished.find((arena) => arena.variant === "standard");
const swissFile = readdirSync("tests/fixtures/lichess").find((name) => /^api_swiss_[A-Za-z0-9]{8}\.json$/.test(name));
const SWISS = swissFile?.slice("api_swiss_".length, -".json".length) ?? "";
const studyFile = readdirSync("tests/fixtures/lichess").find((name) => /^api_study_[A-Za-z0-9]{8}\.pgn$/.test(name));
const STUDY = studyFile?.slice("api_study_".length, -".pgn".length) ?? "";

const paths = () => calls.map((call) => `${call.method} ${call.url.pathname}`);
const form = (call: Call | undefined) => Object.fromEntries(new URLSearchParams(call?.body ?? ""));

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db
			.insert(schema.user)
			.values(["member", "other"].map((id) => ({ id, name: id, email: `${id}@example.com` })));
	});
	vault = await createVault(Buffer.alloc(32, 4).toString("base64"));
});
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	calls.length = 0;
	fetcher.mockClear();
	now = 1_000_000;
});

describe("Tournaments on the server", () => {
	it("reads the arenas' list once a minute", async () => {
		const shared = chaal();
		await events.tournaments(shared);
		await events.tournaments(shared);
		expect(paths()).toEqual(["GET /api/tournament"]);
		now += 61_000;
		await events.tournaments(shared);
		// Stale: served, and read again behind it.
		await vi.waitFor(() => expect(calls).toHaveLength(2));
	});

	it("a visitor's arena is the public read, kept ten minutes once finished", async () => {
		if (!finished) throw new Error("no finished arena recorded");
		const shared = chaal();
		const page = await events.arenaPage(shared, null, finished.id, 1);
		expect(page.viewer).toBeNull();
		expect(page.arena.status).toBe("finished");
		expect(calls[0]?.url.searchParams.get("page")).toBe("1");
		now += 5 * 60_000;
		await events.arenaPage(shared, null, finished.id, 1);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.token).toBeNull();
	});

	it("a connected viewer's arena is read with their token, never cached, and says where they stand", async () => {
		if (!finished) throw new Error("no finished arena recorded");
		await connect("member");
		const shared = chaal();
		const page = await events.arenaPage(shared, session("member"), finished.id, 1);
		expect(page.arena.me).toEqual({ rank: 7, withdraw: false, gameId: null });
		expect(page.viewer).toEqual({ username: "member_li" });
		await events.arenaPage(shared, session("member"), finished.id, 1);
		expect(calls.map((call) => call.token)).toEqual(["lio_member", "lio_member"]);
		// Without the tournaments' scope, the public read (and still a viewer who may reconnect).
		await connect("other", ["team:read"]);
		calls.length = 0;
		const other = await events.arenaPage(shared, session("other"), finished.id, 1);
		expect(other.arena.me).toBeNull();
		expect(calls.map((call) => call.token)).toEqual([null]);
	});

	it("a Swiss tournament with its first players, and whether the viewer is among them", async () => {
		const results = (
			readLichessFixture(
				lichessFixtureName("api", `/api/swiss/${SWISS}/results`, [["nb", "100"]]).replace(/\.json$/, ".ndjson"),
			) ?? ""
		)
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as { username: string });
		const first = results[0]?.username ?? "";
		await connect("member", ALL, first);
		await connect("other", ALL, "nobody_here");
		const shared = chaal();
		const page = await events.swissPage(shared, session("member"), SWISS);
		expect(page.swiss.standings.length).toBe(results.length);
		expect(page.viewer).toEqual({ username: first, joined: true });
		expect(calls.find((call) => call.url.pathname.endsWith("/results"))?.url.searchParams.get("nb")).toBe("100");
		const other = await events.swissPage(shared, session("other"), SWISS);
		expect(other.viewer?.joined).toBe(page.swiss.nbPlayers > results.length ? null : false);
		// Public reads: no token.
		expect(calls.every((call) => call.token === null)).toBe(true);
	});

	it("joins an arena with a password, a team and pair-me-ASAP, a Swiss one with its password only, and withdraws", async () => {
		await connect("member");
		await events.join(deps(), "member", {
			kind: "arena",
			id: "abcdEFGH",
			password: "secret",
			team: "team-a",
			pairMeAsap: true,
		});
		await events.join(deps(), "member", {
			kind: "swiss",
			id: "ijklMNOP",
			password: "pw",
			team: "team-a",
			pairMeAsap: true,
		});
		await events.withdraw(deps(), "member", "arena", "abcdEFGH");
		expect(paths()).toEqual([
			"POST /api/tournament/abcdEFGH/join",
			"POST /api/swiss/ijklMNOP/join",
			"POST /api/tournament/abcdEFGH/withdraw",
		]);
		expect(form(calls[0])).toEqual({ password: "secret", team: "team-a", pairMeAsap: "true" });
		expect(form(calls[1])).toEqual({ password: "pw" });
		expect(calls.every((call) => call.token === "lio_member")).toBe(true);
	});
});

describe("Teams on the server", () => {
	it("a team: its newest thirty members and its tournaments, cached; a viewer's place read with their token", async () => {
		const shared = chaal();
		const page = await teams.teamPage(shared, null, TEAM);
		expect(page.team.members).toHaveLength(30);
		expect(page.team.swiss.length).toBeGreaterThan(0);
		expect(page.viewer).toBeNull();
		expect(calls.find((call) => call.url.pathname.endsWith("/swiss"))?.url.searchParams.get("max")).toBe("10");
		const before = calls.length;
		await teams.teamPage(shared, null, TEAM);
		expect(calls).toHaveLength(before);
		await connect("member");
		const mine = await teams.teamPage(shared, session("member"), TEAM);
		expect(mine.viewer).toEqual({ joined: true, requested: false });
		expect(calls.at(-1)?.token).toBe("lio_member");
	});

	it("leaves the tournaments out while tournaments are off", async () => {
		await teams.teamPage(chaal({ features: { tournaments: false } }), null, TEAM);
		expect(paths().some((path) => path.endsWith("/swiss") || path.endsWith("/arena"))).toBe(false);
	});

	it("the player's teams, joining with a message and a password, and leaving", async () => {
		await connect("member");
		const mine = await teams.myTeams(deps(), "member");
		expect(mine[0]?.id).toBe(TEAM);
		await teams.joinTeam(deps(), "member", { id: TEAM, message: "Hello", password: "pw" });
		await teams.leaveTeam(deps(), "member", TEAM);
		expect(paths()).toEqual([
			"GET /api/team/of/member_li",
			`POST /api/team/${TEAM}/join`,
			`POST /api/team/${TEAM}/quit`,
		]);
		expect(form(calls[1])).toEqual({ message: "Hello", password: "pw" });
	});
});

describe("Studies on the server", () => {
	it("an account's studies, the first hundred", async () => {
		const read = await studies.studiesBy(chaal(), "Lichess");
		expect(read.by).toBe("lichess");
		expect(read.studies).toHaveLength(100);
	});

	it("a study's chapters without their PGN, a chapter's PGN from the same read, and a missing chapter's 404", async () => {
		const shared = chaal();
		const study = await studies.study(shared, null, STUDY);
		expect(study.chapters.length).toBeGreaterThan(1);
		expect(JSON.stringify(study)).not.toContain("[Event");
		const chapter = await studies.studyChapter(shared, null, STUDY, study.chapters[1]?.id ?? "");
		expect(chapter.pgn).toContain("[Event");
		await expect(studies.studyChapter(shared, null, STUDY, "zzzzZZZZ")).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(paths()).toEqual([`GET /api/study/${STUDY}.pgn`]);
		await expect(studies.study(shared, null, "abcdEFGH")).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("a connected viewer's study is read with their token and kept apart from the public one", async () => {
		await connect("member");
		const shared = chaal();
		await studies.study(shared, session("member"), STUDY);
		await studies.study(shared, null, STUDY);
		await studies.study(shared, session("member"), STUDY);
		expect(calls.map((call) => call.token)).toEqual(["lio_member", null]);
	});

	it("the player's studies, and saving the board as a chapter", async () => {
		await connect("member");
		await studies.myStudies(deps(), "member");
		const saved = await studies.saveToStudy(deps(), "member", {
			study: STUDY,
			name: "My line",
			pgn: "1. e4 e5 *",
			orientation: "black",
		});
		expect(saved).toEqual({ study: STUDY, chapter: "newCHAP1" });
		expect(paths()).toEqual(["GET /api/study/by/member_li", `POST /api/study/${STUDY}/import-pgn`]);
		expect(form(calls[1])).toEqual({ pgn: "1. e4 e5 *", name: "My line", orientation: "black", variant: "standard" });
	});
});
