import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { m } from "@/paraglide/messages";
import {
	type Color,
	checkSquare,
	isPromotion,
	legalDests,
	type MoveInput,
	opposite,
	type PlayedMove,
	type Promotion,
	play,
	premoveDests,
	turnOf,
} from "../chess/rules";
import { pieceWord, sideName, spokenTurn } from "../chess/speech";
import type { CHAAL_BOARD_THEMES } from "../look/board-themes";
import type { CHAAL_PIECE_SETS } from "../settings/preferences";
import { FILES, isDarkSquare, placementOf, type Square } from "./fen";
import { cellOf, keyPieces, type Orientation, squareAt, squareFromPoint } from "./geometry";
import { BoardPlate } from "./plate";
import { PromotionPicker } from "./promotion-picker";
import { type Shape, Shapes, toggleShape } from "./shapes";
import { playSound, soundOfSan } from "./sounds";

/**
 * The board (PLAN 13.5, "The board"; decision 0262): Chaal's own, on the diagram plate.
 * Controlled: it shows `fen` and reports a legal move with `onMove` (already played, with
 * its SAN and the position after); the page puts the new FEN back within the same frame.
 *
 * - **Pointer:** drag a piece, or click it and then its target. Legal targets show as ink
 *   dots (rings on captures), drawn with a paper halo so they read on hatching.
 * - **Keyboard:** the board is one tab stop, a grid. Arrow keys move a cursor, Enter or
 *   Space picks up and puts down, Escape puts back. Each square names itself ("e4, White
 *   Knight, last move"); one polite live region speaks moves ("Black: knight to f6").
 * - **Promotion:** the picker, unless `autoQueen`.
 * - **Premoves:** when only the other side may move now and `onPremove` is given, the
 *   player's pieces can be given one premove (any square they could reach by geometry).
 * - **Shapes:** `shapes` are drawn; with `onShapesChange`, a right-drag draws an arrow and
 *   a right-click a circle (ink), and a left click clears them.
 * - **Motion:** a moved piece slides (150 ms, `ch-move`), nothing under reduced motion.
 * - **Sound:** `sound` (a volume) plays the move's sound when `lastMove` changes.
 */
export type BoardProps = {
	fen: string;
	orientation?: Orientation;
	/** Whose pieces the player may move. */
	movable?: Color | "both" | "none";
	/** The move into this position: ringed, spoken and sounded when it changes. */
	lastMove?: { uci: string; san?: string } | null;
	onMove?: (move: PlayedMove) => void;
	premove?: MoveInput | null;
	onPremove?: (premove: MoveInput | null) => void;
	shapes?: ReadonlyArray<Shape>;
	onShapesChange?: (shapes: Shape[]) => void;
	autoQueen?: boolean;
	coordinates?: boolean;
	theme?: (typeof CHAAL_BOARD_THEMES)[number];
	pieces?: (typeof CHAAL_PIECE_SETS)[number];
	/** A volume (0–100) for move sounds, or off. */
	sound?: number | false;
	/** The board's name to assistive technology ("Your game against Sherpa_77"). */
	label?: string;
	className?: string;
};

type Press = { pointerId: number; from: Square | null; x: number; y: number; dragging: boolean; wasSelected: boolean };
type Drag = { from: Square; x: number; y: number; size: number };

const squaresOf = (uci: string | undefined): Square[] =>
	uci && uci.length >= 4 ? [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square] : [];

export function Board({
	fen,
	orientation = "white",
	movable = "none",
	lastMove = null,
	onMove,
	premove = null,
	onPremove,
	shapes = [],
	onShapesChange,
	autoQueen = false,
	coordinates = true,
	theme = "diagram",
	pieces = "cburnett",
	sound = false,
	label,
	className,
}: BoardProps) {
	const id = useId();
	const frame = useRef<HTMLDivElement>(null);
	const grid = useRef<HTMLDivElement>(null);
	const press = useRef<Press | null>(null);
	const drawFrom = useRef<Square | null>(null);
	const [selected, setSelected] = useState<Square | null>(null);
	const [drag, setDrag] = useState<Drag | null>(null);
	const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
	const [cursor, setCursor] = useState<Square>(
		() => squaresOf(lastMove?.uci)[1] ?? (orientation === "white" ? "e2" : "e7"),
	);
	const [said, setSaid] = useState("");

	const placement = placementOf(fen);
	const turn = turnOf(fen);
	const live = movable === "both" || movable === turn;
	const premoving = !live && (movable === "white" || movable === "black") && Boolean(onPremove);
	const mover: Color | null = live ? turn : premoving ? (movable as Color) : null;
	const dests = live ? legalDests(fen) : mover ? premoveDests(fen, mover) : new Map<Square, Square[]>();
	const targets = selected ? (dests.get(selected) ?? []) : [];
	const check = checkSquare(fen);
	const last = squaresOf(lastMove?.uci);
	const pre = premove ? [premove.from, premove.to] : [];
	const sideOf = (square: Square): Color | null => {
		const code = placement.get(square);
		return code ? (code[0] === "w" ? "white" : "black") : null;
	};
	const canPick = (square: Square) => mover !== null && sideOf(square) === mover;

	// A new position: pieces keep their keys where they can, so a move slides (React's
	// "adjust state when a prop changes"). Selection and an open picker belong to the old one.
	const [shown, setShown] = useState(() => ({ fen, pieces: keyPieces([], placement) }));
	let keyed = shown.pieces;
	if (shown.fen !== fen) {
		keyed = keyPieces(shown.pieces, placement);
		setShown({ fen, pieces: keyed });
		setSelected(null);
		setPromotion(null);
	}

	// The move into this position is spoken once, when it changes (not on the first render).
	const moveKey = lastMove ? `${fen} ${lastMove.uci}` : "";
	const [heard, setHeard] = useState(moveKey);
	if (heard !== moveKey) {
		setHeard(moveKey);
		if (lastMove?.san) setSaid(spokenTurn(lastMove.san, opposite(turn)));
	}
	const sounded = useRef(moveKey);
	const san = lastMove?.san;
	useEffect(() => {
		if (sounded.current === moveKey) return;
		sounded.current = moveKey;
		if (san && sound !== false) playSound(soundOfSan(san), sound);
	}, [moveKey, san, sound]);

	const commit = (input: MoveInput) => {
		const played = play(fen, input);
		if (!played) {
			setSaid(m.ch_board_illegal());
			return;
		}
		onMove?.(played);
	};

	const attempt = (from: Square, to: Square) => {
		setSelected(null);
		if (!live) {
			onPremove?.({ from, to });
			return;
		}
		if (isPromotion(fen, from, to)) {
			if (autoQueen) commit({ from, to, promotion: "q" });
			else setPromotion({ from, to });
			return;
		}
		commit({ from, to });
	};

	const pick = (square: Square, speak: boolean) => {
		setSelected(square);
		const code = placement.get(square);
		if (speak && code) setSaid(m.ch_board_picked({ piece: pieceWord(code[1] ?? ""), square }));
	};

	/** A click, or Enter/Space on the cursor's square. */
	const activate = (square: Square, speak: boolean) => {
		if (promotion) return;
		if (selected) {
			if (square === selected) {
				setSelected(null);
				if (speak) setSaid(m.ch_board_put_back());
			} else if (targets.includes(square)) attempt(selected, square);
			else if (canPick(square)) pick(square, speak);
			else {
				setSelected(null);
				if (speak) setSaid(m.ch_board_illegal());
			}
			return;
		}
		if (canPick(square)) pick(square, speak);
		else if (premove) onPremove?.(null);
	};

	const box = () => frame.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 };
	// The square pressed: the cell under the pointer, or (while a drag holds the pointer) the point.
	const squareOf = (event: PointerEvent) => {
		const cell = event.target instanceof Element ? event.target.closest("[data-square]") : null;
		if (cell && frame.current?.contains(cell)) return cell.getAttribute("data-square") as Square;
		return squareFromPoint(event.clientX, event.clientY, box(), orientation);
	};

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		const square = squareOf(event);
		if (!square) return;
		if (event.button === 2 && onShapesChange) {
			drawFrom.current = square;
			return;
		}
		if (event.button !== 0) return;
		if (onShapesChange && shapes.length > 0) onShapesChange([]);
		const pickable = canPick(square) && !(selected && targets.includes(square));
		press.current = {
			pointerId: event.pointerId,
			from: pickable ? square : null,
			x: event.clientX,
			y: event.clientY,
			dragging: false,
			wasSelected: selected === square,
		};
		if (pickable && !promotion) {
			setSelected(square);
			event.currentTarget.setPointerCapture?.(event.pointerId);
		}
	};

	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const current = press.current;
		if (!current?.from || current.pointerId !== event.pointerId) return;
		if (!current.dragging && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return;
		current.dragging = true;
		const { left, top, width } = box();
		setDrag({ from: current.from, x: event.clientX - left, y: event.clientY - top, size: width / 8 });
	};

	const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const square = squareOf(event);
		if (event.button === 2 && drawFrom.current) {
			const from = drawFrom.current;
			drawFrom.current = null;
			if (square && onShapesChange) onShapesChange(toggleShape(shapes, { from, to: square, brush: "ink" }));
			return;
		}
		const current = press.current;
		press.current = null;
		if (!current || current.pointerId !== event.pointerId) return;
		if (current.dragging && current.from) {
			setDrag(null);
			if (square && square !== current.from && (dests.get(current.from) ?? []).includes(square)) {
				attempt(current.from, square);
			} else if (square !== current.from) setSelected(null);
			return;
		}
		if (!square) return;
		setCursor(square);
		if (current.from === square) {
			// A press on a piece selected it; releasing on the same, already selected piece puts it back.
			if (current.wasSelected) setSelected(null);
			return;
		}
		activate(square, false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step: Record<string, [number, number]> = {
			ArrowUp: [0, -1],
			ArrowDown: [0, 1],
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
		};
		const move = step[event.key];
		if (move) {
			event.preventDefault();
			const at = cellOf(cursor, orientation);
			const next = squareAt({ col: at.col + move[0], row: at.row + move[1] }, orientation);
			if (next) setCursor(next);
		} else if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			activate(cursor, true);
		} else if (event.key === "Escape" && selected) {
			event.preventDefault();
			setSelected(null);
			setSaid(m.ch_board_put_back());
		}
	};

	const choose = (choice: Promotion) => {
		if (!promotion) return;
		const { from, to } = promotion;
		setPromotion(null);
		commit({ from, to, promotion: choice });
		grid.current?.focus({ preventScroll: true });
	};

	const cancelPromotion = () => {
		setPromotion(null);
		setSaid(m.ch_board_put_back());
		grid.current?.focus({ preventScroll: true });
	};

	const describe = (square: Square) => {
		const code = placement.get(square);
		const side = sideOf(square);
		const parts = [
			code && side
				? m.ch_board_square_piece({ square, side: sideName(side), piece: pieceWord(code[1] ?? "") })
				: square,
		];
		if (square === selected) parts.push(m.ch_board_selected());
		if (targets.includes(square)) parts.push(m.ch_board_target());
		if (last.includes(square)) parts.push(m.ch_board_last_move());
		if (pre.includes(square)) parts.push(m.ch_board_premove());
		if (square === check) parts.push(m.ch_board_in_check());
		return parts.join(", ");
	};

	const at = (square: Square) => {
		const { col, row } = cellOf(square, orientation);
		return { left: `${col * 12.5}%`, top: `${row * 12.5}%` };
	};
	const interactive = mover !== null || Boolean(onShapesChange);
	const rows = Array.from({ length: 8 }, (_, row) =>
		Array.from({ length: 8 }, (_, col) => squareAt({ col, row }, orientation) as Square),
	);
	const promotionCell = promotion ? cellOf(promotion.to, orientation) : null;

	return (
		<BoardPlate
			theme={theme}
			orientation={orientation}
			coordinates={coordinates}
			className={className}
			innerClassName="relative"
			data-testid="chaal-board"
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: pointer input (drag, click, right-drag); the keyboard goes through the grid inside. */}
			<div
				ref={frame}
				className={`absolute inset-0 select-none ${interactive ? "touch-none" : ""}`}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={() => {
					press.current = null;
					setDrag(null);
				}}
				onContextMenu={onShapesChange ? (event) => event.preventDefault() : undefined}
			>
				{/* biome-ignore lint/a11y/useSemanticElements: the board is a CSS grid of squares; a <table> would lose its layout. The grid, rows and cells are the ARIA grid pattern with aria-activedescendant. */}
				<div
					ref={grid}
					role="grid"
					tabIndex={0}
					aria-label={label ?? m.ch_board_label()}
					aria-describedby={`${id}-keys`}
					aria-activedescendant={`${id}-${cursor}`}
					onKeyDown={onKeyDown}
					className="group absolute inset-0 flex flex-col outline-none"
				>
					{rows.map((row) => (
						// biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: a row of the grid above; focus stays on the grid (aria-activedescendant).
						<div key={row[0]} role="row" className="grid flex-1 grid-cols-8">
							{row.map((square) => (
								// biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: a square of the grid; the grid holds focus and points at the cursor's square (aria-activedescendant).
								<div
									key={square}
									id={`${id}-${square}`}
									role="gridcell"
									aria-label={describe(square)}
									aria-selected={square === selected}
									data-square={square}
									className={`${isDarkSquare(FILES.indexOf(square[0] as (typeof FILES)[number]), Number(square[1])) ? "ch-sq-dark" : "ch-sq-light"} ${
										square === cursor
											? "group-focus-visible:shadow-[inset_0_0_0_3px_var(--ch-frame),inset_0_0_0_6px_var(--ch-paper)]"
											: ""
									} ${canPick(square) ? "cursor-grab" : ""}`}
								/>
							))}
						</div>
					))}
				</div>
				<span id={`${id}-keys`} className="sr-only">
					{m.ch_board_keys()}
				</span>

				{/* Marks under the pieces: the last move, the selection, a premove, check. */}
				<div aria-hidden className="pointer-events-none absolute inset-0">
					{last.map((square) => (
						<span
							key={`last-${square}`}
							className="absolute size-[12.5%] border-[3px] border-ch-sq-mark"
							style={at(square)}
						/>
					))}
					{pre.map((square) => (
						<span
							key={`pre-${square}`}
							className="absolute size-[12.5%] border-[3px] border-ch-sq-mark border-dashed"
							style={at(square)}
							data-mark="premove"
						/>
					))}
					{selected ? (
						<span
							className="absolute size-[12.5%] border-[3px] border-ch-sq-mark shadow-[inset_0_0_0_3px_var(--ch-paper)]"
							style={at(selected)}
							data-mark="selected"
						/>
					) : null}
					{check ? (
						<span className="absolute size-[12.5%]" style={at(check)} data-mark="check">
							<span className="absolute inset-[4%] rounded-full border-[4px] border-ch-sq-mark" />
						</span>
					) : null}
				</div>

				{/* The pieces; a new orientation is a new layer, so flipping doesn't slide them. */}
				<div key={orientation} aria-hidden className="pointer-events-none absolute inset-0">
					{keyed.map((piece) => {
						const { col, row } = cellOf(piece.square, orientation);
						const dragging = drag?.from === piece.square;
						return (
							<img
								key={piece.key}
								src={`/chaal/pieces/${pieces}/${piece.code}.svg`}
								alt=""
								width={45}
								height={45}
								draggable={false}
								data-piece={piece.code}
								data-at={piece.square}
								className={`absolute top-0 left-0 size-[12.5%] select-none ${dragging ? "z-10" : "ch-move"}`}
								style={{
									transform: dragging
										? `translate(${drag.x - drag.size / 2}px, ${drag.y - drag.size / 2}px)`
										: `translate(${col * 100}%, ${row * 100}%)`,
								}}
							/>
						);
					})}
				</div>

				{/* Where the selected piece can go, over the pieces. */}
				<div aria-hidden className="pointer-events-none absolute inset-0">
					{targets.map((square) =>
						placement.has(square) ? (
							<span key={square} className="absolute size-[12.5%]" style={at(square)} data-mark="capture">
								<span className="absolute inset-[6%] rounded-full border-[3px] border-ch-sq-dot shadow-[0_0_0_2px_var(--ch-paper),inset_0_0_0_2px_var(--ch-paper)]" />
							</span>
						) : (
							<span
								key={square}
								className="absolute flex size-[12.5%] items-center justify-center"
								style={at(square)}
								data-mark="dot"
							>
								<span className="block size-[28%] rounded-full bg-ch-sq-dot shadow-[0_0_0_3px_var(--ch-paper)]" />
							</span>
						),
					)}
				</div>

				<Shapes shapes={shapes} orientation={orientation} />

				{promotion && promotionCell ? (
					<PromotionPicker
						color={turn}
						col={promotionCell.col}
						fromTop={promotionCell.row === 0}
						pieces={pieces}
						onPick={choose}
						onCancel={cancelPromotion}
					/>
				) : null}
			</div>
			<p aria-live="polite" className="sr-only" data-testid="chaal-board-said">
				{said}
			</p>
		</BoardPlate>
	);
}
