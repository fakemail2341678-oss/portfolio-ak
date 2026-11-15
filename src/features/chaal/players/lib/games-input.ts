import type { PlayerSearch } from "../../search";
import type { PlayerGamesInput } from "../schema";

/** The games tab's input from the URL: only what's set, so equal filters share a key. */
export function gamesInputOf(username: string, search: PlayerSearch): PlayerGamesInput {
	const input: PlayerGamesInput = { username };
	if (search.perf) input.perf = search.perf;
	if (search.color) input.color = search.color;
	if (search.mode) input.rated = search.mode === "rated";
	if (search.result) input.result = search.result;
	if (search.vs) input.vs = search.vs;
	if (search.since) input.since = search.since;
	if (search.until) input.until = search.until;
	if (search.before) input.before = search.before;
	return input;
}

/** The latest games on the overview: the first page with no filter (the games in progress first). */
export const latestGamesInput = (username: string): PlayerGamesInput => ({ username });
