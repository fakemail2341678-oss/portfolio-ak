import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PlayedMove } from "../chess/rules";
import {
	addMove,
	createTree,
	deleteFrom,
	type GameTree,
	type NodeShape,
	nodeOf,
	playOn,
	promoteLine,
	promoteVariation,
	setComment,
	setShapes,
	stepFrom,
	toggleNag,
} from "../chess/tree";
import type { ChaalAnalysis } from "./schema";
import { type AnalysisSearch, searchFromTree, treeFromSearch } from "./url";

const route = getRouteApi("/_chaal/app/chaal/analysis");

/** How long the URL waits for the board to settle before it follows (a burst of ← is one write). */
const URL_DELAY_MS = 250;

export type Step = "first" | "prev" | "next" | "last";

/** A game brought in by "Import" or opened from "My analyses". */
export type LoadedGame = {
	tree: GameTree;
	tags?: Record<string, string>;
	orientation?: "white" | "black";
	/** Where to show it: the start, or the end of the main line (an imported game). */
	at?: "start" | "end";
	saved?: { id: string; title: string };
};

type BoardState = {
	tree: GameTree;
	current: string;
	orientation: "white" | "black";
	tags: Record<string, string>;
	/** The saved analysis this is (its id and title), or null. */
	saved: { id: string; title: string } | null;
	/** Changed since it was saved (or since it opened, for an unsaved board). */
	dirty: boolean;
};

function initialState(search: AnalysisSearch, saved: ChaalAnalysis | null | undefined): BoardState {
	if (saved) {
		return {
			tree: saved.tree,
			current: saved.tree.root,
			orientation: saved.orientation,
			tags: saved.tags,
			saved: { id: saved.id, title: saved.title },
			dirty: false,
		};
	}
	const { tree, current } = treeFromSearch(search);
	return { tree, current, orientation: search.orientation ?? "white", tags: {}, saved: null, dirty: false };
}

/**
 * The analysis board's state (PLAN Task 75): the game tree, the node shown, the board's
 * side, the PGN tags, and whether it's a saved analysis with changes. The URL follows the
 * board (`replace`, so Back leaves the page); a saved analysis keeps only its `id` there.
 * A link to another position while the page is open starts that board.
 */
export function useAnalysisBoard(saved: ChaalAnalysis | null | undefined) {
	const search = route.useSearch();
	const navigate = route.useNavigate();
	const [state, setState] = useState<BoardState>(() => initialState(search, saved));
	/** The search this page last wrote, to tell its own writes from a link followed. */
	const written = useRef<string>(JSON.stringify(searchOf(state)));

	// A link followed to this page (another position, a new board) starts again from it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the URL itself starts again.
	useEffect(() => {
		const incoming = JSON.stringify(search);
		if (incoming === written.current) return;
		if (search.id && search.id === state.saved?.id) return;
		written.current = incoming;
		setState(initialState(search, search.id ? saved : null));
	}, [search]);

	// The URL follows the board.
	useEffect(() => {
		const next = searchOf(state);
		const text = JSON.stringify(next);
		if (text === written.current) return;
		const timer = setTimeout(() => {
			written.current = text;
			void navigate({ to: ".", search: next, replace: true, resetScroll: false });
		}, URL_DELAY_MS);
		return () => clearTimeout(timer);
	}, [state, navigate]);

	const change = (update: (state: BoardState) => Partial<BoardState>, dirty = true) =>
		setState((previous) => ({ ...previous, ...update(previous), ...(dirty ? { dirty: true } : {}) }));

	const node = nodeOf(state.tree, state.current);

	return {
		...state,
		node,
		select: (id: string) => change(() => ({ current: id }), false),
		step: (step: Step) => change((previous) => ({ current: stepFrom(previous.tree, previous.current, step) }), false),
		flip: () => change((previous) => ({ orientation: previous.orientation === "white" ? "black" : "white" }), false),
		/** A move made on the board: a new variation unless it's already there. */
		play: (move: PlayedMove) =>
			change((previous) => {
				const added = addMove(previous.tree, previous.current, move);
				return { tree: added.tree, current: added.id };
			}),
		/** Plays a line of UCI moves from the node shown (an engine line, up to the move picked). */
		playLine: (moves: ReadonlyArray<string>) =>
			change((previous) => {
				let { tree, current } = previous;
				for (const uci of moves) {
					const played = playOn(tree, current, uci);
					if (!played) break;
					tree = played.tree;
					current = played.id;
				}
				return { tree, current };
			}),
		setShapes: (shapes: ReadonlyArray<NodeShape>) =>
			change((previous) => ({ tree: setShapes(previous.tree, previous.current, shapes) })),
		toggleNag: (id: string, nag: number) => change((previous) => ({ tree: toggleNag(previous.tree, id, nag) })),
		setComment: (id: string, text: string) => change((previous) => ({ tree: setComment(previous.tree, id, text) })),
		promote: (id: string) => change((previous) => ({ tree: promoteVariation(previous.tree, id) })),
		makeMain: (id: string) => change((previous) => ({ tree: promoteLine(previous.tree, id) })),
		/** Deletes a move and what follows; the board goes to its parent when it showed one of them. */
		remove: (id: string) =>
			change((previous) => {
				const target = nodeOf(previous.tree, id);
				if (!target.parent) return {};
				const tree = deleteFrom(previous.tree, id);
				return { tree, current: tree.nodes[previous.current] ? previous.current : target.parent };
			}),
		/** Opens a game (imported or saved); an imported one is new, unsaved. */
		load: (game: LoadedGame) => {
			const end = game.at === "end" ? stepFrom(game.tree, game.tree.root, "last") : game.tree.root;
			setState((previous) => ({
				tree: game.tree,
				current: end,
				orientation: game.orientation ?? previous.orientation,
				tags: game.tags ?? {},
				saved: game.saved ?? null,
				dirty: !game.saved,
			}));
		},
		/** A new board from the start or a FEN. */
		reset: (fen?: string) =>
			setState((previous) => {
				const tree = createTree(fen);
				return { tree, current: tree.root, orientation: previous.orientation, tags: {}, saved: null, dirty: false };
			}),
		/** After saving: this is that analysis now. */
		markSaved: (savedAs: { id: string; title: string }) =>
			setState((previous) => ({ ...previous, saved: savedAs, dirty: false })),
		forget: () => setState((previous) => ({ ...previous, saved: null })),
		/** Puts a tree back as it was (undoing a delete). */
		restore: (tree: GameTree, current: string) => change(() => ({ tree, current })),
	};
}

export type AnalysisBoard = ReturnType<typeof useAnalysisBoard>;

/** The URL for a state: a saved analysis by id, else the board itself. */
function searchOf(state: BoardState): AnalysisSearch {
	return state.saved ? { id: state.saved.id } : searchFromTree(state.tree, state.current, state.orientation);
}
