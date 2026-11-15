import type { Score } from "./eval";
import { SUFFIX_NAGS } from "./notation";
import { checkFen, type GameResult, type PlayedMove, play, type Square, START_FEN } from "./rules";
import { createTree, type GameTree, type NodeShape, nodeOf, type TreeNode } from "./tree";

/**
 * PGN in and out (PLAN 13.5, "PGN"; decision 0261): our own reader and writer, with
 * variations, comments, NAGs and the move suffixes (`!`, `?!` …), and the comment commands
 * `[%clk]`, `[%eval]`, `[%cal]` and `[%csl]` (arrows and circles, Task 75) read into the
 * tree. Other commands stay in the comment's text, so a round trip keeps them. Moves are read with chess.js's
 * lenient SAN; a move that isn't legal stops the import with its place.
 *
 * Imports are capped at 500 KB and 2,000 moves, variations included. Only the first game
 * of a file is read, and only standard chess (PLAN 13.5: variants open on Lichess).
 */

export const PGN_MAX_BYTES = 500_000;
export const PGN_MAX_MOVES = 2_000;

export type PgnResult = GameResult | "*";

export type PgnGame = { tags: Record<string, string>; tree: GameTree; result: PgnResult };

export type PgnRead =
	| { ok: true; game: PgnGame }
	| { ok: false; reason: "empty" | "too-large" | "too-long" | "variant" | "fen" | "move"; move?: string };

const TAG = /^\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/;
const RESULT = /1-0|0-1|1\/2-1\/2|½-½|\*/y;
/** A move number ("12.", "12...", "12"), but not the zeros of "0-0". */
const NUMBER = /\d+(?:\s*\.+|(?=\s|$))/y;
const MOVE = /[a-zA-Z0-9♔♕♖♗♘][a-zA-Z0-9=+#\-♔♕♖♗♘]*/y;
const SUFFIX = /[!?]{1,2}/y;
const NAG = /\$\d+/y;
const CLOCK = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\s*\]/;
const EVAL = /\[%eval\s+(#?)([+-]?\d+(?:\.\d+)?)(?:,\d+)?\s*\]/;
const STANDARD = new Set(["standard", "from position"]);
/** Arrows and circles: `[%cal Ge2e4,Rd1d8]`, `[%csl Gd4]` (G, R, Y, B: green, red, yellow, blue). */
const ARROWS = /\[%cal\s+([^\]]*)\]/;
const CIRCLES = /\[%csl\s+([^\]]*)\]/;
const SHAPE = /^([GRYB])([a-h][1-8])([a-h][1-8])?$/;

type Comment = { text: string; clock?: number; eval?: Score; shapes?: NodeShape[] };

/**
 * Shapes in Chaal's two brushes: red is the annotator's vermilion ("mark"), the others
 * ink (decision 0264). Written back, "mark" is red and "ink" green.
 */
function readShapes(list: string, kind: "arrow" | "circle"): NodeShape[] {
	return list.split(",").flatMap((entry) => {
		const match = SHAPE.exec(entry.trim());
		if (!match || (kind === "arrow") !== Boolean(match[3])) return [];
		const brush = match[1] === "R" ? "mark" : "ink";
		const from = match[2] as Square;
		return [match[3] ? { from, to: match[3] as Square, brush } : { from, brush }];
	});
}

/** `[%clk]`, `[%eval]`, `[%cal]` and `[%csl]` out of a comment, and the text that's left. */
function readComment(raw: string): Comment {
	let text = raw;
	const out: Comment = { text: "" };
	for (const [pattern, kind] of [
		[ARROWS, "arrow"],
		[CIRCLES, "circle"],
	] as const) {
		const found = pattern.exec(text);
		if (!found) continue;
		out.shapes = [...(out.shapes ?? []), ...readShapes(found[1] ?? "", kind)];
		text = text.replace(pattern, "");
	}
	const clock = CLOCK.exec(text);
	if (clock) {
		out.clock = Math.round((Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])) * 1000);
		text = text.replace(CLOCK, "");
	}
	const evaluation = EVAL.exec(text);
	if (evaluation) {
		const value = Number(evaluation[2]);
		out.eval = evaluation[1] ? { mate: Math.trunc(value) } : { cp: Math.round(value * 100) };
		text = text.replace(EVAL, "");
	}
	// Any other command (`[%anno …]`, `[%emt …]`, `[%timestamp …]`) is for programs, not readers (Task 85).
	out.text = text
		.replace(/\[%\w+[^\]]*\]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return out;
}

const LETTERS: Readonly<Record<string, string>> = { "♔": "K", "♕": "Q", "♖": "R", "♗": "B", "♘": "N" };
const lettersOf = (san: string) => san.replace(/[♔♕♖♗♘]/g, (glyph) => LETTERS[glyph] ?? glyph);

/** Reads the first game of a PGN. */
export function readPgn(text: string): PgnRead {
	if (new TextEncoder().encode(text).length > PGN_MAX_BYTES) return { ok: false, reason: "too-large" };
	let rest = text.replace(/^\uFEFF/, "");
	const tags: Record<string, string> = {};
	for (;;) {
		rest = rest.replace(/^\s+/, "");
		if (rest.startsWith("%")) {
			rest = rest.replace(/^%[^\n]*/, "");
			continue;
		}
		const tag = TAG.exec(rest);
		if (!tag) break;
		tags[tag[1] as string] = (tag[2] as string).replace(/\\(["\\])/g, "$1");
		rest = rest.slice(tag[0].length);
	}
	if (tags.Variant && !STANDARD.has(tags.Variant.toLowerCase())) return { ok: false, reason: "variant" };
	let start = START_FEN;
	if (tags.FEN) {
		const checked = checkFen(tags.FEN);
		if (!checked.ok) return { ok: false, reason: "fen" };
		start = checked.fen;
	}

	const tree = createTree(start);
	const nodes: Record<string, TreeNode> = { ...tree.nodes };
	let next = tree.next;
	let moves = 0;
	// Where the next move goes, and the last move of this line (comments and NAGs attach to it).
	type Line = { parent: string; last: string | null };
	let line: Line = { parent: tree.root, last: null };
	const stack: Line[] = [];
	let pending: string[] = [];
	let result: PgnResult | null = null;

	const node = (id: string) => nodeOf({ ...tree, nodes }, id);
	const annotate = (id: string, change: Partial<TreeNode>) => {
		nodes[id] = { ...node(id), ...change };
	};
	const attach = (parentId: string, move: PlayedMove): string => {
		const parent = node(parentId);
		const twin = parent.children.find((child) => node(child).uci === move.uci);
		if (twin) return twin;
		const id = String(next++);
		nodes[id] = {
			id,
			parent: parentId,
			ply: parent.ply + 1,
			uci: move.uci,
			san: move.san,
			fen: move.fen,
			children: [],
			comments: pending,
			nags: [],
		};
		pending = [];
		nodes[parentId] = { ...parent, children: [...parent.children, id] };
		return id;
	};

	// Sticky patterns read at \`index\` without copying the rest of the text: linear in its size.
	const body = rest;
	let index = 0;
	const take = (pattern: RegExp): string | null => {
		pattern.lastIndex = index;
		const match = pattern.exec(body);
		if (!match) return null;
		index += match[0].length;
		return match[0];
	};
	const addNag = (id: string | null, nag: number | undefined) => {
		if (id && nag) annotate(id, { nags: [...node(id).nags, nag] });
	};
	while (index < body.length && result === null) {
		const char = body[index] as string;
		if (/\s/.test(char)) {
			index++;
		} else if (char === "[") {
			// A tag in the movetext is the next game's: this one ended without a result.
			break;
		} else if (char === "{") {
			const end = body.indexOf("}", index);
			const raw = body.slice(index + 1, end === -1 ? body.length : end);
			index = end === -1 ? body.length : end + 1;
			const comment = readComment(raw);
			const shapes = comment.shapes?.length ? comment.shapes : null;
			if (line.last) {
				const target = node(line.last);
				annotate(line.last, {
					...(comment.text ? { comments: [...target.comments, comment.text] } : {}),
					...(comment.clock !== undefined ? { clock: comment.clock } : {}),
					...(comment.eval ? { eval: comment.eval } : {}),
					...(shapes ? { shapes: [...(target.shapes ?? []), ...shapes] } : {}),
				});
			} else if (shapes && line.parent === tree.root && stack.length === 0) {
				// Shapes before the first move are drawn on the start position.
				annotate(tree.root, { shapes: [...(node(tree.root).shapes ?? []), ...shapes] });
			}
			if (!line.last && comment.text) {
				// Before a line's first move: the game's comment at the root, else the next move's.
				if (line.parent === tree.root && stack.length === 0) {
					annotate(tree.root, { comments: [...node(tree.root).comments, comment.text] });
				} else pending.push(comment.text);
			}
		} else if (char === ";") {
			const end = body.indexOf("\n", index);
			index = end === -1 ? body.length : end + 1;
		} else if (char === "(") {
			index++;
			if (!line.last) return { ok: false, reason: "move", move: "(" };
			stack.push(line);
			line = { parent: node(line.last).parent as string, last: null };
		} else if (char === ")") {
			index++;
			line = stack.pop() ?? line;
			pending = [];
		} else if (char === "$") {
			const nag = take(NAG);
			if (nag) addNag(line.last, Number(nag.slice(1)));
			else index++;
		} else if (body.startsWith("--", index)) {
			// A null move ("--"): ChessBase writes them, chess.js can't play them.
			return { ok: false, reason: "move", move: "--" };
		} else {
			const token = take(RESULT);
			if (token) {
				if (stack.length === 0) result = token === "½-½" ? "1/2-1/2" : (token as PgnResult);
				continue;
			}
			if (take(NUMBER)) continue;
			const suffix = take(SUFFIX);
			if (suffix) {
				addNag(line.last, SUFFIX_NAGS[suffix]);
				continue;
			}
			const san = take(MOVE);
			if (!san) {
				index++;
				continue;
			}
			const move = play(node(line.parent).fen, lettersOf(san));
			if (!move) return { ok: false, reason: "move", move: san };
			moves++;
			if (moves > PGN_MAX_MOVES) return { ok: false, reason: "too-long" };
			const id = attach(line.parent, move);
			line = { parent: id, last: id };
			const glyph = take(SUFFIX);
			if (glyph) addNag(id, SUFFIX_NAGS[glyph]);
		}
	}
	if (moves === 0 && Object.keys(tags).length === 0 && result === null) return { ok: false, reason: "empty" };
	const tagResult = tags.Result;
	const final: PgnResult =
		result ?? (tagResult === "1-0" || tagResult === "0-1" || tagResult === "1/2-1/2" ? tagResult : "*");
	return { ok: true, game: { tags, tree: { root: tree.root, nodes, next }, result: final } };
}

const ROSTER = ["Event", "Site", "Date", "Round", "White", "Black", "Result"] as const;

const escapeTag = (value: string) => value.replace(/[\\"]/g, (char) => `\\${char}`);

function formatClockTag(ms: number): string {
	const tenths = Math.round(ms / 100);
	const seconds = Math.floor(tenths / 10);
	const fraction = tenths % 10;
	const time = `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
	return fraction ? `${time}.${fraction}` : time;
}

const formatEvalTag = (score: Score) => ("mate" in score ? `#${score.mate}` : (score.cp / 100).toFixed(2));

const shapeTag = (shape: NodeShape) => `${shape.brush === "mark" ? "R" : "G"}${shape.from}${shape.to ?? ""}`;

/** `[%cal …]` and `[%csl …]` for a node's arrows and circles. */
function shapeTags(shapes: ReadonlyArray<NodeShape> = []): string[] {
	const arrows = shapes.filter((shape) => shape.to);
	const circles = shapes.filter((shape) => !shape.to);
	return [
		...(arrows.length > 0 ? [`[%cal ${arrows.map(shapeTag).join(",")}]`] : []),
		...(circles.length > 0 ? [`[%csl ${circles.map(shapeTag).join(",")}]`] : []),
	];
}

/** A comment as PGN writes it: commands first, then the text (braces can't nest, so they're replaced). */
function commentOf(node: TreeNode): string | null {
	const parts = [
		...(node.eval ? [`[%eval ${formatEvalTag(node.eval)}]`] : []),
		...(node.clock !== undefined ? [`[%clk ${formatClockTag(node.clock)}]`] : []),
		...shapeTags(node.shapes),
		...node.comments.map((comment) => comment.replace(/[{}]/g, (brace) => (brace === "{" ? "(" : ")"))),
	];
	return parts.length > 0 ? `{ ${parts.join(" ")} }` : null;
}

/**
 * Writes a game as PGN: the seven tags first (with "?" where unknown), the start position
 * when it isn't the usual one, the moves with their numbers, NAGs as `$n`, comments,
 * clocks and evals, variations in parentheses, lines up to 80 characters.
 */
export function writePgn(game: PgnGame): string {
	const { tree } = game;
	const root = nodeOf(tree, tree.root);
	const tags: Record<string, string> = { ...game.tags, Result: game.result };
	if (root.fen !== START_FEN) Object.assign(tags, { SetUp: "1", FEN: root.fen });
	const ordered = [
		...ROSTER.map((key) => [key, tags[key] ?? "?"] as const),
		...Object.entries(tags).filter(([key]) => !(ROSTER as ReadonlyArray<string>).includes(key)),
	];
	const header = ordered.map(([key, value]) => `[${key} "${escapeTag(value)}"]`).join("\n");

	const tokens: string[] = [];
	const rootComment = commentOf({ ...root, eval: undefined, clock: undefined });
	if (rootComment) tokens.push(rootComment);
	const moveText = (node: TreeNode, forceNumber: boolean) => {
		const before = node.ply - 1;
		const number = Math.floor(before / 2) + 1;
		const prefix = before % 2 === 0 ? `${number}. ` : forceNumber ? `${number}... ` : "";
		return `${prefix}${node.san}`;
	};
	const emit = (node: TreeNode, forceNumber: boolean) => {
		tokens.push(moveText(node, forceNumber));
		for (const nag of node.nags) tokens.push(`$${nag}`);
		const comment = commentOf(node);
		if (comment) tokens.push(comment);
		return comment !== null;
	};
	// One line from `parent`: its main move, the alternatives to it, then on down the line.
	const writeLine = (parentId: string, forceFirst: boolean) => {
		let parent = nodeOf(tree, parentId);
		let force = forceFirst;
		while (parent.children.length > 0) {
			const [mainId, ...alternatives] = parent.children;
			const main = nodeOf(tree, mainId as string);
			force = emit(main, force);
			for (const alternative of alternatives) {
				const first = nodeOf(tree, alternative);
				tokens.push("(");
				const forced = emit(first, true);
				writeLine(first.id, forced);
				tokens.push(")");
				force = true;
			}
			parent = main;
		}
		return force;
	};
	writeLine(tree.root, true);
	tokens.push(game.result);

	const lines: string[] = [];
	let current = "";
	for (const token of tokens) {
		const glue = current === "" || current.endsWith("(") || token === ")" ? "" : " ";
		if (current !== "" && current.length + glue.length + token.length > 80) {
			lines.push(current);
			current = token;
		} else current += glue + token;
	}
	if (current) lines.push(current);
	return `${header}\n\n${lines.join("\n")}\n`;
}
