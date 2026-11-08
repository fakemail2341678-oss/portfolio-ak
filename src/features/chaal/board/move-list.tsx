import { type ReactNode, useEffect, useRef } from "react";
import { m } from "@/paraglide/messages";
import { nagSymbol, showSan } from "../chess/notation";
import { type GameTree, mainline, nodeOf, type TreeNode } from "../chess/tree";

/**
 * The moves of a game (PLAN 13.5, `MoveList`; the comps): figurine SAN, the annotator's
 * symbols in vermilion beside a move, and the move shown underlined in vermilion.
 *
 * - `table`: the main line in numbered rows of two (play, archives).
 * - `strip`: the main line in one row that scrolls sideways (a phone's live game).
 * - `tree`: the main line in rows, broken where a move has comments or alternatives, which
 *   follow it inline, variations in parentheses (analysis).
 *
 * Each move is a button that shows it; the list is one tab stop (the move shown), and
 * ←/→ step through the game from anywhere (`useBoardKeys`). A button's name is what it
 * shows (WCAG 2.5.3, label in name); the board speaks the move in words when it's shown.
 */
export function MoveList({
	tree,
	current,
	onSelect,
	layout = "table",
	notation = "figurine",
	className,
}: {
	tree: GameTree;
	/** The node shown. */
	current: string;
	onSelect: (id: string) => void;
	layout?: "table" | "strip" | "tree";
	notation?: "figurine" | "letters";
	className?: string;
}) {
	const list = useRef<HTMLDivElement>(null);
	const line = mainline(tree);
	const focusable = tree.nodes[current]?.parent ? current : line[0]?.id;

	// Keep the move shown in view inside the list (never scroll the page).
	useEffect(() => {
		const box = list.current;
		const shown = box?.querySelector<HTMLElement>(`[data-node="${current}"]`);
		if (!box || !shown) return;
		if (layout === "strip") box.scrollLeft = shown.offsetLeft - box.clientWidth / 2 + shown.clientWidth / 2;
		else if (
			shown.offsetTop < box.scrollTop ||
			shown.offsetTop > box.scrollTop + box.clientHeight - shown.clientHeight
		) {
			box.scrollTop = shown.offsetTop - box.clientHeight / 2;
		}
	}, [current, layout]);

	const move = (node: TreeNode, number: string | null, tone: "main" | "side" = "main") => (
		<button
			key={node.id}
			type="button"
			data-node={node.id}
			aria-current={node.id === current ? "true" : undefined}
			tabIndex={node.id === focusable ? 0 : -1}
			onClick={() => onSelect(node.id)}
			className={`inline-flex items-baseline gap-0.5 whitespace-nowrap px-1 text-start outline-none hover:bg-ch-hair focus-visible:ring-2 focus-visible:ring-ch-ink ${tone === "side" ? "font-normal" : "font-medium"}`}
		>
			{number ? <span className="text-ch-muted">{number}</span> : null}
			<span
				className={node.id === current ? "underline decoration-2 decoration-ch-mark underline-offset-4" : undefined}
			>
				{showSan(node.san ?? "", notation)}
			</span>
			<Symbols nags={node.nags} />
		</button>
	);

	if (line.length === 0) {
		return <p className={`py-2 text-ch-muted text-sm ${className ?? ""}`}>{m.ch_moves_empty()}</p>;
	}

	if (layout === "strip") {
		return (
			<div
				ref={list}
				className={`relative overflow-x-auto py-2 [scrollbar-width:none] ${className ?? ""}`}
				data-testid="chaal-moves"
			>
				<ol aria-label={m.ch_moves_label()} className="flex">
					{line.map((node) => (
						<li key={node.id}>{move(node, numberOf(node, false))}</li>
					))}
				</ol>
			</div>
		);
	}

	// Rows of a white and a black move; in `tree`, a row ends early where comments or alternatives break in.
	const rows: ReactNode[] = [];
	let row: { number: number; white: TreeNode | null; black: TreeNode | null } | null = null;
	const flush = () => {
		if (!row) return;
		const { number, white, black } = row;
		rows.push(
			<li
				key={`row-${white?.id ?? black?.id}`}
				className="ch-hairline grid grid-cols-[2rem_1fr_1fr] items-baseline py-1 tabular-nums"
			>
				<span className="text-ch-muted text-sm">{number}</span>
				<span>{white ? move(white, null) : <span className="px-1 text-ch-muted">…</span>}</span>
				<span>{black ? move(black, null) : null}</span>
			</li>,
		);
		row = null;
	};
	for (const node of line) {
		const white = (node.ply - 1) % 2 === 0;
		const number = Math.floor((node.ply - 1) / 2) + 1;
		if (white || !row || row.number !== number) {
			flush();
			row = { number, white: null, black: null };
		}
		if (white) row.white = node;
		else row.black = node;
		const alternatives = layout === "tree" ? nodeOf(tree, node.parent as string).children.slice(1) : [];
		const comments = layout === "tree" ? node.comments : [];
		if (alternatives.length > 0 || comments.length > 0) {
			flush();
			rows.push(
				<li
					key={`aside-${node.id}`}
					className="ch-hairline flex flex-wrap items-baseline gap-x-0.5 py-1.5 ps-8 text-sm"
				>
					{comments.map((comment) => (
						<Comment key={comment} text={comment} />
					))}
					{alternatives.map((id) => (
						<span key={id} className="inline-flex flex-wrap items-baseline">
							<span aria-hidden className="text-ch-muted">
								(
							</span>
							{variation(tree, id, move)}
							<span aria-hidden className="text-ch-muted">
								)
							</span>
						</span>
					))}
				</li>,
			);
		}
		if (!white) flush();
	}
	flush();
	return (
		<div ref={list} className={`relative overflow-y-auto ${className ?? ""}`} data-testid="chaal-moves">
			<ol aria-label={m.ch_moves_label()}>{rows}</ol>
		</div>
	);
}

/** "12." before a white move; "12…" before a black one when `force` (a line's first move). */
function numberOf(node: TreeNode, force: boolean): string | null {
	const before = node.ply - 1;
	const number = Math.floor(before / 2) + 1;
	if (before % 2 === 0) return `${number}.`;
	return force ? `${number}…` : null;
}

/** A variation inline, as PGN reads: its moves, their comments, and alternatives nested in parentheses. */
function variation(
	tree: GameTree,
	firstId: string,
	move: (node: TreeNode, number: string | null, tone: "main" | "side") => ReactNode,
): ReactNode[] {
	const first = nodeOf(tree, firstId);
	return [
		move(first, numberOf(first, true), "side"),
		...first.comments.map((comment) => <Comment key={`${first.id}-${comment}`} text={comment} />),
		...continueLine(tree, first, first.comments.length > 0, move),
	];
}

/** The rest of a line after `from`, with alternatives at each step. */
function continueLine(
	tree: GameTree,
	from: TreeNode,
	forceFirst: boolean,
	move: (node: TreeNode, number: string | null, tone: "main" | "side") => ReactNode,
): ReactNode[] {
	const out: ReactNode[] = [];
	let parent = from;
	let force = forceFirst;
	while (parent.children.length > 0) {
		const [mainId, ...alternatives] = parent.children;
		const main = nodeOf(tree, mainId as string);
		out.push(move(main, numberOf(main, force), "side"));
		force = main.comments.length > 0;
		for (const comment of main.comments) out.push(<Comment key={`${main.id}-${comment}`} text={comment} />);
		for (const id of alternatives) {
			out.push(
				<span key={`alt-${id}`} className="inline-flex flex-wrap items-baseline">
					<span aria-hidden className="text-ch-muted">
						(
					</span>
					{variation(tree, id, move)}
					<span aria-hidden className="text-ch-muted">
						)
					</span>
				</span>,
			);
			force = true;
		}
		parent = main;
	}
	return out;
}

function Symbols({ nags }: { nags: ReadonlyArray<number> }) {
	const symbols = nags.map(nagSymbol).filter((symbol): symbol is string => symbol !== null);
	if (symbols.length === 0) return null;
	return <span className="font-bold text-ch-mark">{symbols.join("")}</span>;
}

/** Comments are other people's text (PGN, studies): shown as text, never HTML. */
function Comment({ text }: { text: string }) {
	return <span className="px-1 text-ch-muted">{text}</span>;
}
