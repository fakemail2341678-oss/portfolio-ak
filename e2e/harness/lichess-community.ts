/**
 * The fake Lichess's community (Task 83, decision 0273), for e2e. The arenas, a finished
 * Swiss, the team, its members and tournaments, the teams' lists, an account's studies and a
 * study are recordings (`pnpm lichess:record community`); this adds what needs an account:
 *
 * - `POST /api/tournament/{id}/join` and `/withdraw`, `POST /api/swiss/{id}/join` and
 *   `/withdraw` (`tournament:write`): remembered per account, with what joining sent.
 * - `GET /api/tournament/{id}`: the recording (another standings page made from the first),
 *   plus `me` for a token whose account joined; `E2E_ARENA` is the recorded finished arena
 *   restated as being played, with a top game (a recording's state is whatever it was then).
 * - `GET /api/swiss/{id}` for a Swiss tournament of the recorded team's list that has no
 *   recording of its own (one coming up): its line from the list, which has the same shape.
 * - `GET /api/team/{id}` with a token: the recording, plus `joined` and `requested`;
 *   `POST /api/team/{id}/join` (joined at once when the team is open, else asked) and
 *   `/quit`; `GET /api/team/of/{username}` (Lichess wants a token): the teams joined here.
 * - An account's own study (`E2E_STUDY`): `GET /api/study/by/{account}` with its token
 *   lists it, `GET /api/study/{id}.pgn` gives its chapters, and `POST /api/study/{id}/import-pgn`
 *   adds one (another account's study is refused, as Lichess refuses a study one can't write to).
 *
 * Test control: `GET /e2e/lichess/community?account=` says what the account joined and saved.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

type Json = (response: ServerResponse, status: number, body: unknown) => void;

/** An arena being played (the recorded finished one, restated as live), to join in e2e. */
export const E2E_ARENA = "e2eArena";

/** The study each fake account owns: its id is the account's own. */
export const E2E_STUDY: Readonly<Record<string, string>> = { e2e_player: "e2eStdy1", e2e_rival: "e2eStdy2" };

type Chapter = { id: string; name: string; pgn: string };

export function createCommunity({
	read,
	json,
	recordedName,
	readBody,
}: {
	read: (name: string) => string | undefined;
	json: Json;
	/** The recording's file name for an api path and its parameters (`lichessFixtureName`). */
	recordedName: (pathname: string, params?: URLSearchParams) => string;
	readBody: (request: IncomingMessage) => Promise<string>;
}) {
	const arenas = new Map<string, Map<string, { withdraw: boolean; form: Record<string, string> }>>();
	const swiss = new Map<string, Set<string>>();
	const teams = new Map<string, Set<string>>();
	const requests = new Map<string, Set<string>>();
	const chapters = new Map<string, Chapter[]>();

	const of = <T>(map: Map<string, T>, account: string, make: () => T): T => {
		let value = map.get(account);
		if (value === undefined) {
			value = make();
			map.set(account, value);
		}
		return value;
	};

	const recording = (pathname: string, params?: URLSearchParams) => {
		const name = recordedName(pathname, params);
		return read(name) ?? read(name.replace(/\.json$/, ".ndjson"));
	};

	/** A study's PGN: a first chapter, then each one saved. */
	const studyPgn = (id: string, account: string) => {
		const list = [
			{
				id: `${id.slice(0, 4)}Ch01`,
				name: "Start here",
				pgn: "1. e4 e5 2. Nf3 { A first chapter. } *",
			},
			...(chapters.get(id) ?? []),
		];
		return list
			.map(
				(chapter) =>
					`[Event "${account} study: ${chapter.name}"]\n[Site "https://lichess.org/study/${id}/${chapter.id}"]\n[Result "*"]\n[StudyName "${account} study"]\n[ChapterName "${chapter.name.replace(/"/g, "'")}"]\n[ChapterURL "https://lichess.org/study/${id}/${chapter.id}"]\n\n${chapter.pgn.replace(/^\[[^\n]*\]\n/gm, "").trim()}\n`,
			)
			.join("\n\n");
	};

	/** The first finished arena of standard chess in the recorded list: the live one's source. */
	const finishedArena = () => {
		const list = JSON.parse(recording("/api/tournament") ?? "{}") as {
			finished?: Array<{ id: string; variant: { key: string } }>;
		};
		return list.finished?.find((each) => each.variant.key === "standard")?.id ?? null;
	};

	/**
	 * An arena's answer: its recording; another page of its standings made from the first (ten
	 * further down); or `E2E_ARENA`, the finished recording as if it were being played (with a
	 * top game), since a recorded arena's state is whatever it was when recorded.
	 */
	const arenaAnswer = (id: string, page: number): Record<string, unknown> | null => {
		const source = id === E2E_ARENA ? finishedArena() : id;
		if (!source) return null;
		const first = recording(`/api/tournament/${source}`, new URLSearchParams({ page: "1" }));
		if (!first) return null;
		const answer = JSON.parse(first) as Record<string, unknown> & {
			standing?: { page: number; players: Array<{ rank: number }> };
		};
		if (page > 1 && answer.standing) {
			const shift = (page - 1) * 10;
			answer.standing = {
				page,
				players: answer.standing.players.map((player) => ({ ...player, rank: player.rank + shift })),
			};
		}
		if (id !== E2E_ARENA) return answer;
		const { isFinished: _finished, isRecentlyFinished: _recently, podium: _podium, stats: _stats, ...rest } = answer;
		return {
			...rest,
			id: E2E_ARENA,
			isStarted: true,
			secondsToFinish: 1_200,
			featured: {
				id: "e2eWatch",
				fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b",
				orientation: "white",
				color: "black",
				lastMove: "f1b5",
				white: { name: "E2E_Rival", id: "e2e_rival", rank: 1, rating: 2200 },
				black: { name: "E2E_Player", id: "e2e_player", rank: 2, rating: 2100 },
			},
		};
	};

	const ndjson = (response: ServerResponse, lines: unknown[]) => {
		response.writeHead(200, { "content-type": "application/x-ndjson" });
		response.end(lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
	};

	return {
		reset: () => {
			arenas.clear();
			swiss.clear();
			teams.clear();
			requests.clear();
			chapters.clear();
		},
		control(route: string, url: URL, response: ServerResponse): boolean {
			if (route !== "GET /e2e/lichess/community") return false;
			const account = url.searchParams.get("account") ?? "";
			json(response, 200, {
				arenas: Object.fromEntries(arenas.get(account) ?? []),
				swiss: [...(swiss.get(account) ?? [])],
				teams: [...(teams.get(account) ?? [])],
				requests: [...(requests.get(account) ?? [])],
				chapters: (chapters.get(E2E_STUDY[account] ?? "") ?? []).map(({ id, name }) => ({ id, name })),
			});
			return true;
		},
		/** Answers a community path, or returns false for the recordings to answer. */
		async serve(
			pathname: string,
			url: URL,
			request: IncomingMessage,
			response: ServerResponse,
			account: string | null,
		): Promise<boolean> {
			const method = request.method ?? "GET";
			const needToken = () => {
				json(response, 401, { error: "No such token" });
				return true;
			};

			const entry = pathname.match(/^\/api\/(tournament|swiss)\/([A-Za-z0-9]{8})\/(join|withdraw)$/);
			if (entry && method === "POST") {
				if (!account) return needToken();
				const [, kind, id, act] = entry as unknown as [string, string, string, string];
				const form = Object.fromEntries(new URLSearchParams(await readBody(request)));
				if (kind === "tournament") {
					of(arenas, account, () => new Map()).set(id, { withdraw: act === "withdraw", form });
				} else if (act === "join") of(swiss, account, () => new Set<string>()).add(id);
				else swiss.get(account)?.delete(id);
				json(response, 200, { ok: true });
				return true;
			}

			const arena = pathname.match(/^\/api\/tournament\/([A-Za-z0-9]{8})$/);
			if (arena && method === "GET") {
				const id = arena[1] as string;
				const page = Number(url.searchParams.get("page") ?? "1") || 1;
				const answer = arenaAnswer(id, page);
				if (!answer) return false;
				const joined = account ? arenas.get(account)?.get(id) : undefined;
				json(response, 200, { ...answer, ...(joined ? { me: { rank: null, withdraw: joined.withdraw } } : {}) });
				return true;
			}

			const swissPage = pathname.match(/^\/api\/swiss\/([A-Za-z0-9]{8})$/);
			if (swissPage && method === "GET" && recording(pathname) === undefined) {
				// A Swiss tournament from a team's recorded list, not recorded on its own (one coming up).
				for (const name of ["lichess-swiss"]) {
					const list = recording(`/api/team/${name}/swiss`, new URLSearchParams({ max: "10" })) ?? "";
					const line = list
						.split("\n")
						.filter((each) => each.trim())
						.map((each) => JSON.parse(each) as { id: string })
						.find((each) => each.id === swissPage[1]);
					if (line) {
						json(response, 200, line);
						return true;
					}
				}
				return false;
			}

			const team = pathname.match(/^\/api\/team\/([a-z0-9-]+)\/(join|quit)$/);
			if (team && method === "POST") {
				if (!account) return needToken();
				const id = team[1] as string;
				const recorded = recording(`/api/team/${id}`);
				const open = recorded ? (JSON.parse(recorded) as { open?: boolean }).open === true : true;
				if (team[2] === "quit") {
					teams.get(account)?.delete(id);
					requests.get(account)?.delete(id);
				} else if (open) of(teams, account, () => new Set<string>()).add(id);
				else of(requests, account, () => new Set<string>()).add(id);
				json(response, 200, { ok: true });
				return true;
			}

			const teamPage = pathname.match(/^\/api\/team\/([a-z0-9-]+)$/);
			if (teamPage && method === "GET" && account && !["all", "search"].includes(teamPage[1] as string)) {
				const body = recording(pathname);
				if (body === undefined) return false;
				const id = teamPage[1] as string;
				json(response, 200, {
					...(JSON.parse(body) as object),
					joined: teams.get(account)?.has(id) ?? false,
					requested: requests.get(account)?.has(id) ?? false,
				});
				return true;
			}

			if (/^\/api\/team\/of\/[\w-]+$/.test(pathname) && method === "GET") {
				if (!account) return needToken();
				const owner = (pathname.split("/").pop() ?? "").toLowerCase();
				const list = [...(teams.get(owner) ?? [])].flatMap((id) => {
					const body = recording(`/api/team/${id}`);
					return body ? [JSON.parse(body) as unknown] : [];
				});
				json(response, 200, list);
				return true;
			}

			const by = pathname.match(/^\/api\/study\/by\/([\w-]+)$/);
			if (by && method === "GET" && account && (by[1] as string).toLowerCase() === account) {
				const id = E2E_STUDY[account];
				ndjson(
					response,
					id ? [{ id, name: `${account} study`, createdAt: 1_790_000_000_000, updatedAt: 1_790_000_000_000 }] : [],
				);
				return true;
			}

			const owned = Object.entries(E2E_STUDY).find(([, id]) => pathname === `/api/study/${id}.pgn`);
			if (owned && method === "GET") {
				response.writeHead(200, { "content-type": "application/x-chess-pgn" });
				response.end(studyPgn(owned[1], owned[0]));
				return true;
			}

			const save = pathname.match(/^\/api\/study\/([A-Za-z0-9]{8})\/import-pgn$/);
			if (save && method === "POST") {
				if (!account) return needToken();
				if (E2E_STUDY[account] !== save[1]) {
					json(response, 403, { error: "Not a contributor" });
					return true;
				}
				const form = new URLSearchParams(await readBody(request));
				const list = of(chapters, save[1] as string, () => [] as Chapter[]);
				const chapter = {
					id: `${(save[1] as string).slice(0, 4)}Ch${String(list.length + 2).padStart(2, "0")}`,
					name: form.get("name") ?? "Chapter",
					pgn: form.get("pgn") ?? "*",
				};
				list.push(chapter);
				json(response, 200, { chapters: [{ id: chapter.id, name: chapter.name }] });
				return true;
			}
			return false;
		},
	};
}
