import type { Score } from "./eval";
import { type MoveInput, type PlayedMove, play, START_FEN } from "./rules";

/**
 * Chaal's game tree (PLAN 13.5, `tree.ts`; decision 0261): a game with its variations, as
 * analysis, PGN, local games and archives hold it. Flat: nodes by id, each naming its
 * parent and its children in order (the first child is the main line), so a change copies
 * one or two nodes and the whole tree is plain JSON (stored as jsonb from Task 75).
 *
 * The functions never mutate a tree they're given; each returns a new one.
 */
export type TreeNode = {
	id: string;
	parent: string | null;
	/** Half-moves from the game's start position: the root is 0, after 1.e4 it's 1 (or more, from a FEN). */
	ply: number;
	/** The move into this position; null at the root. */
	uci: string | null;
	san: string | null;
	fen: string;
	children: string[];
	comments: string[];
	nags: number[];
	eval?: Score;
	/** The mover's clock after the move, in ms (PGN's `[%clk]`). */
	clock?: number;
};

export type GameTree = { root: string; nodes: Record<string, TreeNode>; next: number };

/** The ply of a position: (move number − 1) × 2, plus one when Black is to move. */
const plyOf = (fen: string) => {
	const [, turn, , , , fullMove] = fen.split(" ");
	return (Math.max(1, Number(fullMove) || 1) - 1) * 2 + (turn === "b" ? 1 : 0);
};

export function createTree(fen: string = START_FEN): GameTree {
	const root: TreeNode = {
		id: "0",
		parent: null,
		ply: plyOf(fen),
		uci: null,
		san: null,
		fen,
		children: [],
		comments: [],
		nags: [],
	};
	return { root: root.id, nodes: { [root.id]: root }, next: 1 };
}

export function nodeOf(tree: GameTree, id: string): TreeNode {
	const node = tree.nodes[id];
	if (!node) throw new Error(`No node ${id} in this tree`);
	return node;
}

type Extra = Partial<Pick<TreeNode, "comments" | "nags" | "eval" | "clock">>;

/**
 * Adds a played move after `parentId`, as a new last child (a variation, or the main line
 * when it's the first). A move that's already there is reused (and given `extra`), so
 * playing the same move twice never makes a twin.
 */
export function addMove(
	tree: GameTree,
	parentId: string,
	move: PlayedMove,
	extra: Extra = {},
): { tree: GameTree; id: string } {
	const parent = nodeOf(tree, parentId);
	const existing = parent.children.map((child) => nodeOf(tree, child)).find((child) => child.uci === move.uci);
	if (existing) {
		if (Object.keys(extra).length === 0) return { tree, id: existing.id };
		return { tree: { ...tree, nodes: { ...tree.nodes, [existing.id]: { ...existing, ...extra } } }, id: existing.id };
	}
	const id = String(tree.next);
	const node: TreeNode = {
		id,
		parent: parentId,
		ply: parent.ply + 1,
		uci: move.uci,
		san: move.san,
		fen: move.fen,
		children: [],
		comments: [],
		nags: [],
		...extra,
	};
	return {
		tree: {
			root: tree.root,
			nodes: { ...tree.nodes, [parentId]: { ...parent, children: [...parent.children, id] }, [id]: node },
			next: tree.next + 1,
		},
		id,
	};
}

/** Plays a move (squares, UCI or SAN) after a node; null when it isn't legal there. */
export function playOn(
	tree: GameTree,
	parentId: string,
	input: MoveInput | string,
): { tree: GameTree; id: string; move: PlayedMove } | null {
	const move = play(nodeOf(tree, parentId).fen, input);
	return move ? { ...addMove(tree, parentId, move), move } : null;
}

/** The nodes from the root to `id`, both included. */
export function pathTo(tree: GameTree, id: string): TreeNode[] {
	const path: TreeNode[] = [];
	for (
		let node: TreeNode | undefined = nodeOf(tree, id);
		node;
		node = node.parent ? tree.nodes[node.parent] : undefined
	) {
		path.push(node);
	}
	return path.reverse();
}

/** Every position from the start to `id`: what `gameState` counts repetitions in. */
export const fensTo = (tree: GameTree, id: string) => pathTo(tree, id).map((node) => node.fen);

/** The main line from `id` on (first children), `id` included. */
export function lineFrom(tree: GameTree, id: string): TreeNode[] {
	const line: TreeNode[] = [];
	for (
		let node: TreeNode | undefined = nodeOf(tree, id);
		node;
		node = node.children[0] ? tree.nodes[node.children[0]] : undefined
	) {
		line.push(node);
	}
	return line;
}

/** The game's main line, without the root. */
export const mainline = (tree: GameTree) => lineFrom(tree, tree.root).slice(1);

/** Where ←, →, Home and End go from a node: the parent, the main child, the start, the end of this line. */
export function stepFrom(tree: GameTree, id: string, step: "first" | "prev" | "next" | "last"): string {
	const node = nodeOf(tree, id);
	switch (step) {
		case "first":
			return tree.root;
		case "prev":
			return node.parent ?? node.id;
		case "next":
			return node.children[0] ?? node.id;
		case "last":
			return lineFrom(tree, id).at(-1)?.id ?? node.id;
	}
}

/** Whether a node is on the game's main line. */
export const isMainline = (tree: GameTree, id: string) =>
	pathTo(tree, id).every((node, index, path) => index === 0 || path[index - 1]?.children[0] === node.id);

/** Makes the line through `id` the main line: at every branch on its way, its move comes first. */
export function promoteLine(tree: GameTree, id: string): GameTree {
	const nodes = { ...tree.nodes };
	for (const node of pathTo(tree, id).slice(1)) {
		const parentId = node.parent as string;
		const parent = nodeOf({ ...tree, nodes }, parentId);
		if (parent.children[0] === node.id) continue;
		nodes[parentId] = { ...parent, children: [node.id, ...parent.children.filter((child) => child !== node.id)] };
	}
	return { ...tree, nodes };
}

/** Deletes a move and everything after it. The root can't be deleted. */
export function deleteFrom(tree: GameTree, id: string): GameTree {
	const node = nodeOf(tree, id);
	if (!node.parent) return tree;
	const nodes = { ...tree.nodes };
	const drop = [id];
	while (drop.length > 0) {
		const next = drop.pop() as string;
		drop.push(...(nodes[next]?.children ?? []));
		delete nodes[next];
	}
	const parent = nodeOf(tree, node.parent);
	nodes[parent.id] = { ...parent, children: parent.children.filter((child) => child !== id) };
	return { ...tree, nodes };
}

/** How many moves a tree holds, variations included (PGN imports are capped, PLAN 13.5). */
export const sizeOf = (tree: GameTree) => Object.keys(tree.nodes).length - 1;
