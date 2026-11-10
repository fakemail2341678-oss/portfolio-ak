import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readPgn } from "@/features/chaal/chess/pgn";
import { DEFAULT_COMMUNITY_LIMITS, readCommunityLimits } from "@/features/chaal/community/limits";
import { tourPace } from "@/features/chaal/events/labels";
import { tournamentJoinInput } from "@/features/chaal/events/schema";
import { studiesSearch, teamsSearch, tournamentPageSearch, tournamentsSearch } from "@/features/chaal/search";
import { chapterIdOf, readStudy, splitStudy, studyAddress, tagsOf } from "@/features/chaal/studies/chapters";
import { chapterShown } from "@/features/chaal/studies/queries";
import { saveToStudyInput } from "@/features/chaal/studies/schema";
import { teamJoinInput } from "@/features/chaal/teams/schema";
import { createLichess } from "@/server/chaal/lichess/client";
import {
	arenaAnswer,
	arenaLineAnswer,
	studyImportAnswer,
	studyLineAnswer,
	swissAnswer,
	swissLineAnswer,
	swissResultAnswer,
	teamAnswer,
	teamMemberAnswer,
	teamPageAnswer,
	teamsOfAnswer,
	tournamentListAnswer,
} from "@/server/chaal/lichess/schemas";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";

/**
 * Community (Task 83, decision 0273): Lichess's recorded answers (pnpm lichess:record
 * community) as Chaal maps them, a study read into chapters, a study's address, the
 * admin's controls, the inputs and URL contracts, and the client's capped ndjson read.
 */

const json = (name: string): unknown => JSON.parse(readLichessFixture(name) ?? "null");
const lines = (name: string): unknown[] =>
	(readLichessFixture(name) ?? "")
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line));

const TEAM = "lichess-swiss";
const list = tournamentListAnswer.parse(json("api_tournament.json"));
const firstStandard = (state: "created" | "started" | "finished") =>
	list[state].find((arena) => arena.variant === "standard");

describe("Tournaments as Chaal reads them", () => {
	it("maps Lichess's arenas: each state, standard first, with clocks, times and the winner", () => {
		expect(list.created.length + list.started.length + list.finished.length).toBeGreaterThan(10);
		for (const arena of [...list.created, ...list.started, ...list.finished]) {
			expect(arena.id).toMatch(/^[A-Za-z0-9]{8}$/);
			expect(arena.finishesAt).toBeGreaterThan(arena.startsAt);
		}
		expect(list.created.every((arena) => arena.status === "created")).toBe(true);
		expect(list.finished.every((arena) => arena.status === "finished")).toBe(true);
		expect(list.finished.some((arena) => arena.winner)).toBe(true);
		expect(list.created.some((arena) => arena.official)).toBe(true);
	});

	it("maps an arena of each state: standings, the podium and stats once finished, the top game while played", () => {
		for (const state of ["created", "started", "finished"] as const) {
			const summary = firstStandard(state);
			if (!summary) continue;
			const arena = arenaAnswer.parse(
				json(lichessFixtureName("api", `/api/tournament/${summary.id}`, [["page", "1"]])),
			);
			expect(arena.id).toBe(summary.id);
			expect(arena.variant).toBe("standard");
			expect(arena.standing.page).toBe(1);
			expect(arena.pages).toBe(Math.max(1, Math.ceil(arena.nbPlayers / 10)));
			expect(arena.url).toBe(`https://lichess.org/tournament/${summary.id}`);
			// A visitor's answer says nothing of them.
			expect(arena.me).toBeNull();
			if (state === "finished") {
				expect(arena.status).toBe("finished");
				expect(arena.podium?.length).toBeGreaterThan(0);
				expect(arena.stats?.games).toBeGreaterThan(0);
			}
			if (state === "created") expect(arena.status).toBe("created");
			for (const player of arena.standing.players) {
				expect(player.rank).toBeGreaterThan(0);
				expect(player.sheet).not.toMatch(/[^0-9]/);
			}
		}
	});

	it("reads where a player stands when their token asks, and a team battle's teams", () => {
		const summary = firstStandard("finished");
		if (!summary) throw new Error("no finished arena recorded");
		const raw = json(lichessFixtureName("api", `/api/tournament/${summary.id}`, [["page", "1"]])) as object;
		const arena = arenaAnswer.parse({
			...raw,
			me: { rank: 4, withdraw: false, gameId: "abcdEFGH" },
			teamBattle: { teams: { "team-a": ["Team A", "flair"], "team-b": "Team B" } },
		});
		expect(arena.me).toEqual({ rank: 4, withdraw: false, gameId: "abcdEFGH" });
		expect(arena.teams).toEqual([
			{ id: "team-a", name: "Team A" },
			{ id: "team-b", name: "Team B" },
		]);
	});

	it("maps a Swiss tournament, its results and a team's lists", () => {
		const swissList = lines(
			lichessFixtureName("api", `/api/team/${TEAM}/swiss`, [["max", "10"]]).replace(/\.json$/, ".ndjson"),
		);
		expect(swissList.length).toBeGreaterThan(0);
		for (const line of swissList) expect(swissLineAnswer.safeParse(line).success).toBe(true);
		const arenas = lines(
			lichessFixtureName("api", `/api/team/${TEAM}/arena`, [["max", "10"]]).replace(/\.json$/, ".ndjson"),
		);
		for (const line of arenas) expect(arenaLineAnswer.safeParse(line).success).toBe(true);
	});

	it("maps the recorded finished Swiss and its standings", () => {
		const swiss = swissAnswer.parse(json(recordedSwiss()));
		expect(swiss.status).toBe("finished");
		expect(swiss.round).toBe(swiss.nbRounds);
		expect(swiss.nextRoundAt).toBeNull();
		expect(swiss.url).toBe(`https://lichess.org/swiss/${swiss.id}`);
		const results = lines(
			lichessFixtureName("api", `/api/swiss/${swiss.id}/results`, [["nb", "100"]]).replace(/\.json$/, ".ndjson"),
		).map((line) => swissResultAnswer.parse(line));
		expect(results[0]?.rank).toBe(1);
		expect(results.every((player, index) => index === 0 || player.points <= (results[index - 1]?.points ?? 0))).toBe(
			true,
		);
	});

	it("puts a tournament's clock as a game's", () => {
		expect(tourPace({ limit: 60, increment: 0 })).toBe("1+0");
		expect(tourPace({ limit: 180, increment: 2 })).toBe("3+2");
		expect(tourPace({ limit: 30, increment: 0 })).toBe("½+0");
	});
});

/** The recorded finished Swiss tournament's file (its id is whatever was finished when recording). */
function recordedSwiss(): string {
	const file = readdirSync("tests/fixtures/lichess").find((name: string) =>
		/^api_swiss_[A-Za-z0-9]{8}\.json$/.test(name),
	);
	if (!file) throw new Error("no Swiss recorded");
	return file;
}

describe("Teams as Chaal reads them", () => {
	it("maps the popular teams and a search, a page at a time", () => {
		const popular = teamPageAnswer.parse(json(lichessFixtureName("api", "/api/team/all", [["page", "1"]])));
		expect(popular.page).toBe(1);
		expect(popular.next).toBe(2);
		expect(popular.teams.length).toBeGreaterThan(0);
		for (const team of popular.teams) expect((team.description ?? "").length).toBeLessThanOrEqual(280);
		const found = teamPageAnswer.parse(
			json(
				lichessFixtureName("api", "/api/team/search", [
					["text", "nepal"],
					["page", "1"],
				]),
			),
		);
		expect(found.teams.length).toBeGreaterThan(0);
	});

	it("maps a team with its leaders and whether a token's player is in it, and its newest members", () => {
		const team = teamAnswer.parse(json(lichessFixtureName("api", `/api/team/${TEAM}`)));
		expect(team.id).toBe(TEAM);
		expect(team.leaders.length).toBeGreaterThan(0);
		expect(team.joined).toBe(false);
		expect(team.url).toBe(`https://lichess.org/team/${TEAM}`);
		const members = lines(`api_team_${TEAM}_users.ndjson`).map((line) => teamMemberAnswer.parse(line));
		expect(members).toHaveLength(30);
		expect(members.every((member) => member.name && member.joinedAt)).toBe(true);
		// The teams a player is in: a list of the same shape.
		expect(teamsOfAnswer.parse([json(lichessFixtureName("api", `/api/team/${TEAM}`))])[0]?.id).toBe(TEAM);
	});
});

describe("Studies as Chaal reads them", () => {
	const studies = lines("api_study_by_lichess.ndjson").map((line) => studyLineAnswer.parse(line));
	const study = studies.find((each) => readLichessFixture(lichessFixtureName("api", `/api/study/${each.id}.pgn`)));
	const pgn = study ? (readLichessFixture(lichessFixtureName("api", `/api/study/${study.id}.pgn`)) ?? "") : "";

	it("maps an account's studies", () => {
		expect(studies).toHaveLength(100);
		expect(studies.every((each) => /^[A-Za-z0-9]{8}$/.test(each.id) && each.name)).toBe(true);
	});

	it("reads a study into its chapters, each with its name, address, side and PGN", () => {
		if (!study) throw new Error("no study recorded");
		const read = readStudy(pgn);
		expect(read.name).toBeTruthy();
		expect(read.chapters.length).toBe(splitStudy(pgn).length);
		const ids = new Set(read.chapters.map((chapter) => chapter.id));
		expect(ids.size).toBe(read.chapters.length);
		for (const chapter of read.chapters) {
			expect(chapter.id).toMatch(/^[A-Za-z0-9]{8}$/);
			expect(tagsOf(chapter.pgn).StudyName).toBe(read.name);
			// Every chapter is one Chaal's PGN reader can show (standard chess).
			expect(readPgn(chapter.pgn).ok).toBe(true);
		}
		expect(read.chapters.some((chapter) => chapter.gamebook)).toBe(true);
	});

	it("names a chapter from its address, and its tags with escaped quotes", () => {
		expect(chapterIdOf({ ChapterURL: "https://lichess.org/study/abcdEFGH/ijklMNOP" })).toBe("ijklMNOP");
		expect(chapterIdOf({ Site: "https://lichess.org/study/abcdEFGH/ijklMNOP" })).toBe("ijklMNOP");
		expect(chapterIdOf({ Site: "https://lichess.org/abcdEFGH" })).toBeNull();
		expect(tagsOf('[Event "A \\"quoted\\" name"]\n[Site "?"]\n\n1. e4 *')).toEqual({
			Event: 'A "quoted" name',
			Site: "?",
		});
		// A chapter without an address is dropped; a draw is written as a scoresheet does.
		const read = readStudy(
			'[Event "x"]\n[Result "1/2-1/2"]\n[ChapterURL "https://lichess.org/study/abcdEFGH/ijklMNOP"]\n[Orientation "black"]\n\n1. e4 e5 1/2-1/2\n\n\n[Event "y"]\n\n1. d4 *',
		);
		expect(read.chapters).toHaveLength(1);
		expect(read.chapters[0]).toMatchObject({ id: "ijklMNOP", result: "½-½", orientation: "black", name: "x" });
	});

	it("opens a study from its address or id, and picks the chapter shown", () => {
		expect(studyAddress("abcdEFGH")).toEqual({ id: "abcdEFGH", chapter: null });
		expect(studyAddress(" https://lichess.org/study/abcdEFGH/ijklMNOP#3 ")).toEqual({
			id: "abcdEFGH",
			chapter: "ijklMNOP",
		});
		expect(studyAddress("lichess.org/study/abcdEFGH")).toEqual({ id: "abcdEFGH", chapter: null });
		expect(studyAddress("https://evil.example/study/abcdEFGH")).toBeNull();
		expect(studyAddress("abc")).toBeNull();
		const shape = { chapters: [{ id: "aaaaAAAA" }, { id: "bbbbBBBB" }] };
		expect(chapterShown(shape, {})).toBe("aaaaAAAA");
		expect(chapterShown(shape, { chapter: "bbbbBBBB" })).toBe("bbbbBBBB");
		expect(chapterShown(shape, { chapter: "zzzzZZZZ" })).toBe("aaaaAAAA");
	});

	it("reads what saving made", () => {
		expect(studyImportAnswer.parse({ chapters: [{ id: "abcdEFGH", name: "x" }] })).toEqual({ chapter: "abcdEFGH" });
		expect(studyImportAnswer.parse({ chapters: [] })).toEqual({ chapter: null });
	});
});

describe("Community's controls and contracts", () => {
	it("reads the admin's controls, falling back field by field", () => {
		expect(readCommunityLimits(null)).toEqual(DEFAULT_COMMUNITY_LIMITS);
		expect(readCommunityLimits({ joinTeams: false, studiesBy: "  chessbrah " })).toEqual({
			...DEFAULT_COMMUNITY_LIMITS,
			joinTeams: false,
			studiesBy: "chessbrah",
		});
		expect(readCommunityLimits({ studiesBy: "not a name!" }).studiesBy).toBe("lichess");
	});

	it("takes only what joining and saving need", () => {
		expect(tournamentJoinInput.safeParse({ kind: "arena", id: "abcdEFGH", team: "Team A" }).success).toBe(false);
		expect(
			tournamentJoinInput.safeParse({ kind: "arena", id: "abcdEFGH", team: "team-a", pairMeAsap: true }).success,
		).toBe(true);
		expect(teamJoinInput.safeParse({ id: "lichess-swiss", message: "x".repeat(2001) }).success).toBe(false);
		expect(
			saveToStudyInput.safeParse({ study: "abcdEFGH", name: " ", pgn: "1. e4 *", orientation: "white" }).success,
		).toBe(false);
	});

	it("drops what the URL can't hold", () => {
		expect(tournamentsSearch.parse({ view: "other" })).toEqual({});
		expect(tournamentPageSearch.parse({ kind: "swiss", page: "3" })).toEqual({ kind: "swiss", page: 3 });
		expect(tournamentPageSearch.parse({ kind: "x", page: "1" })).toEqual({});
		expect(teamsSearch.parse({ q: "a", page: "40" })).toEqual({});
		expect(studiesSearch.parse({ by: "a b" })).toEqual({});
	});
});

describe("The client's capped ndjson read", () => {
	it("reads the first lines of a long answer and leaves the rest", async () => {
		let pulled = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulled += 1;
				controller.enqueue(new TextEncoder().encode(`{"id":"m${pulled}"}\n{"id":"n${pulled}"}\n`));
				if (pulled > 1_000) controller.close();
			},
		});
		const lichess = createLichess(
			{ apiBase: "https://lichess.test", explorerBase: "", tablebaseBase: "", userAgent: "t" },
			async () => new Response(body),
		);
		const read = await lichess.lines({ endpoint: "x", path: "/x", lane: "public" }, z.object({ id: z.string() }), 5);
		expect(read.map((line) => line.id)).toEqual(["m1", "n1", "m2", "n2", "m3"]);
		expect(pulled).toBeLessThan(10);
	});
});
