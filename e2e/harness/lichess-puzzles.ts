/**
 * The fake Lichess's puzzles (Task 80, decision 0269), for e2e. Its pool is a recorded
 * batch (`pnpm lichess:record puzzles`) plus the daily puzzle:
 *
 * - `GET /api/puzzle/{id}`: from the pool, else 404.
 * - `GET /api/puzzle/batch/{angle}`: the pool's first `nb`; with a token, only the puzzles
 *   that account hasn't solved (Lichess returns unseen ones to a signed-in player), and its
 *   rating (`glicko`). Themes, difficulty and colour aren't filtered: the pool is small.
 * - `POST /api/puzzle/batch/{angle}` (`puzzle:write`): records the solutions, answers each
 *   one's rating change (+8 a win, −8 a miss), and the next `nb` unseen puzzles.
 * - `GET /api/puzzle/dashboard/{days}` and `/api/puzzle/replay/{days}/{theme}` (`puzzle:read`):
 *   from what the account has posted; replay 404s when nothing was missed in the theme.
 *
 * Test control: `GET /e2e/lichess/puzzle-solutions?account=` lists what an account posted.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

type PuzzleAndGame = { game: unknown; puzzle: { id: string; rating: number; themes: string[] } };
type Solution = { id: string; win: boolean; angle: string };

export function createPuzzles({ read }: { read: (name: string) => string | undefined }) {
	const solved = new Map<string, Solution[]>();

	const pool = (): PuzzleAndGame[] => {
		const batch = read("api_puzzle_batch_mix.ee86ce24.json");
		const daily = read("api_puzzle_daily.json");
		const puzzles = batch ? ((JSON.parse(batch) as { puzzles: PuzzleAndGame[] }).puzzles ?? []) : [];
		return daily ? [...puzzles, JSON.parse(daily) as PuzzleAndGame] : puzzles;
	};
	const byId = (id: string) => pool().find((entry) => entry.puzzle.id === id);
	const unseen = (account: string | null) => {
		const done = new Set((account ? (solved.get(account) ?? []) : []).map((solution) => solution.id));
		return pool().filter((entry) => !done.has(entry.puzzle.id));
	};
	const glicko = (account: string) => ({
		rating: 1500 + (solved.get(account) ?? []).reduce((sum, solution) => sum + (solution.win ? 8 : -8), 0),
		deviation: 80,
		provisional: false,
	});

	const json = (response: ServerResponse, status: number, body: unknown) => {
		response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
		response.end(JSON.stringify(body));
	};

	const readBody = async (request: IncomingMessage) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(chunk as Buffer);
		return Buffer.concat(chunks).toString("utf8");
	};

	return {
		reset: () => solved.clear(),
		/** Test controls; false when `route` isn't one. */
		control(route: string, url: URL, response: ServerResponse): boolean {
			if (route !== "GET /e2e/lichess/puzzle-solutions") return false;
			json(response, 200, { solutions: solved.get(url.searchParams.get("account") ?? "") ?? [] });
			return true;
		},
		/**
		 * A puzzle call: `account` is the token's account (null without a token, or with one
		 * the fake doesn't know). False when `pathname` isn't a puzzle path this module answers.
		 */
		async serve(
			pathname: string,
			url: URL,
			request: IncomingMessage,
			response: ServerResponse,
			account: string | null,
			hasToken: boolean,
		): Promise<boolean> {
			if (!pathname.startsWith("/api/puzzle/") || pathname === "/api/puzzle/daily") return false;
			const nb = Math.max(0, Math.min(50, Number(url.searchParams.get("nb") ?? 15)));
			const batch = /^\/api\/puzzle\/batch\/(\w+)$/.exec(pathname);
			if (batch) {
				if (hasToken && !account) {
					json(response, 401, { error: "No such token" });
					return true;
				}
				const angle = batch[1] ?? "mix";
				if (request.method === "POST") {
					if (!account) {
						json(response, 401, { error: "Unauthorized" });
						return true;
					}
					const body = JSON.parse((await readBody(request)) || "{}") as {
						solutions?: Array<{ id: string; win: boolean }>;
					};
					const solutions = (body.solutions ?? []).map((solution) => ({ ...solution, angle }));
					solved.set(account, [...(solved.get(account) ?? []), ...solutions]);
					json(response, 200, {
						puzzles: unseen(account).slice(0, nb),
						glicko: glicko(account),
						rounds: solutions.map((solution) => ({
							id: solution.id,
							win: solution.win,
							ratingDiff: solution.win ? 8 : -8,
						})),
					});
					return true;
				}
				json(response, 200, {
					puzzles: unseen(account).slice(0, nb || 15),
					...(account ? { glicko: glicko(account) } : {}),
				});
				return true;
			}
			if (request.method !== "GET") return false;
			const dashboard = /^\/api\/puzzle\/dashboard\/(\d+)$/.exec(pathname);
			const replay = /^\/api\/puzzle\/replay\/(\d+)\/(\w+)$/.exec(pathname);
			if (dashboard || replay) {
				if (!account) {
					json(response, 401, { error: "No such token" });
					return true;
				}
				const mine = solved.get(account) ?? [];
				if (replay) {
					const theme = replay[2] ?? "mix";
					const missed = mine.filter(
						(solution) =>
							!solution.win && (theme === "mix" || (byId(solution.id)?.puzzle.themes ?? []).includes(theme)),
					);
					if (missed.length === 0) json(response, 404, { error: "No puzzles to replay" });
					else
						json(response, 200, {
							replay: { days: Number(replay[1]), theme, nb: missed.length, remaining: missed.map((s) => s.id) },
							angle: { key: theme, name: theme, desc: "" },
						});
					return true;
				}
				const perf = (list: Solution[]) => ({
					nb: list.length,
					firstWins: list.filter((solution) => solution.win).length,
					replayWins: 0,
					puzzleRatingAvg: 1500,
					performance: 1500 + list.reduce((sum, solution) => sum + (solution.win ? 50 : -50), 0),
				});
				const themes = new Map<string, Solution[]>();
				for (const solution of mine) {
					for (const theme of byId(solution.id)?.puzzle.themes ?? []) {
						themes.set(theme, [...(themes.get(theme) ?? []), solution]);
					}
				}
				json(response, 200, {
					days: Number(dashboard?.[1] ?? 30),
					global: perf(mine),
					themes: Object.fromEntries([...themes].map(([key, list]) => [key, { theme: key, results: perf(list) }])),
				});
				return true;
			}
			const one = /^\/api\/puzzle\/(\w+)$/.exec(pathname);
			if (one) {
				const found = byId(one[1] ?? "");
				if (found) json(response, 200, found);
				else json(response, 404, { error: "Not found" });
				return true;
			}
			return false;
		},
	};
}
