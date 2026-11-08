import { checkFen, START_FEN } from "../chess/rules";
import { createTree, type GameTree, lineFrom, pathTo, playOn } from "../chess/tree";

/**
 * The analysis board's URL (PLAN Task 75; decision 0264): `fen` (the start, when it isn't
 * the usual one), `moves` (one line from there, in UCI joined by "_"), `ply` (how far along
 * it the board is, when not at its end) and `orientation` (when Black is at the bottom). A
 * link opens the same board, drawn on the server. Variations aren't in the URL: saving or
 * the PGN keeps them.
 */
export type AnalysisSearch = {
	fen?: string;
	moves?: string;
	ply?: number;
	orientation?: "white" | "black";
	/** A saved analysis (the owner's only). */
	id?: string;
};

/** A line longer than PGN's cap isn't read past it. */
const MAX_URL_MOVES = 2_000;

/** The tree a URL describes, and the node it shows: the moves are played until one isn't legal. */
export function treeFromSearch(search: AnalysisSearch): { tree: GameTree; current: string } {
	const fen = search.fen ? checkFen(search.fen) : null;
	let tree = createTree(fen?.ok ? fen.fen : START_FEN);
	const ids = [tree.root];
	for (const uci of (search.moves ?? "").split("_").filter(Boolean).slice(0, MAX_URL_MOVES)) {
		const played = playOn(tree, ids.at(-1) as string, uci);
		if (!played) break;
		tree = played.tree;
		ids.push(played.id);
	}
	const ply = search.ply === undefined ? ids.length - 1 : Math.min(Math.max(0, search.ply), ids.length - 1);
	return { tree, current: ids[ply] as string };
}

/** The URL for the board: the line through `current` (to its end), and where on it the board is. */
export function searchFromTree(
	tree: GameTree,
	current: string,
	orientation: "white" | "black",
): Omit<AnalysisSearch, "id"> {
	const path = pathTo(tree, current);
	const line = [...path, ...lineFrom(tree, current).slice(1)];
	const root = line[0];
	const moves = line.slice(1).map((node) => node.uci as string);
	const ply = path.length - 1;
	return {
		...(root && root.fen !== START_FEN ? { fen: root.fen } : {}),
		...(moves.length > 0 ? { moves: moves.join("_") } : {}),
		...(ply < moves.length ? { ply } : {}),
		...(orientation === "black" ? { orientation } : {}),
	};
}

/** A link to the board as it is now, for sharing. */
export function shareUrl(origin: string, path: string, search: Omit<AnalysisSearch, "id">): string {
	const url = new URL(path, origin);
	for (const [key, value] of Object.entries(search)) {
		if (value !== undefined) url.searchParams.set(key, String(value));
	}
	return url.toString();
}
