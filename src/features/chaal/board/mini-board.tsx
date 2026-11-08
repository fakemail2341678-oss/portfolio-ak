import type { CHAAL_BOARD_THEMES } from "../look/board-themes";
import type { CHAAL_PIECE_SETS } from "../settings/preferences";
import { FILES, isDarkSquare, type PieceCode, placementOf, RANKS, type Square } from "./fen";
import { BoardPlate } from "./plate";

/**
 * A static diagram of a position (PLAN 13.5, "Kit": `MiniBoard`): drawn on the server, no
 * JavaScript, nothing to load but the piece files. The home's hero uses it (Task 73); the
 * TV, games and studies use it from Task 74 on. It's a printed diagram: squares in the
 * board theme (hatched in "diagram"), the heavy double frame, the coordinates outside it,
 * and vermilion rings on the marked squares (the last move). Squares are HTML, not SVG, so
 * the board theme's tokens (a CSS pattern for the hatching) apply as they do on the board.
 *
 * One image to assistive technology: `label` says what it shows ("Ruy Lopez, after 3.Bb5");
 * without one it's decoration (a board theme's swatch, beside its name).
 */
export function MiniBoard({
	fen,
	label,
	marks = [],
	theme = "diagram",
	pieces = "cburnett",
	coordinates = true,
	orientation = "white",
	className,
}: {
	fen: string;
	label?: string;
	marks?: ReadonlyArray<Square>;
	theme?: (typeof CHAAL_BOARD_THEMES)[number];
	pieces?: (typeof CHAAL_PIECE_SETS)[number];
	coordinates?: boolean;
	orientation?: "white" | "black";
	className?: string;
}) {
	const board = placementOf(fen);
	const files = orientation === "white" ? FILES : [...FILES].reverse();
	const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();
	const marked = new Set<string>(marks);
	const piece = (code: PieceCode) => `/chaal/pieces/${pieces}/${code}.svg`;
	return (
		<BoardPlate
			{...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
			theme={theme}
			orientation={orientation}
			coordinates={coordinates}
			className={className}
			innerClassName="grid grid-cols-8 grid-rows-8"
			data-testid="chaal-mini-board"
		>
			{ranks.map((rank) =>
				files.map((file) => {
					const square = `${file}${rank}` as Square;
					const code = board.get(square);
					return (
						<div
							key={square}
							className={`relative ${isDarkSquare(FILES.indexOf(file), rank) ? "ch-sq-dark" : "ch-sq-light"}`}
						>
							{marked.has(square) ? <span className="absolute inset-0 border-[3px] border-ch-sq-mark" /> : null}
							{code ? (
								<img
									src={piece(code)}
									alt=""
									width={45}
									height={45}
									draggable={false}
									className="absolute inset-0 size-full select-none"
								/>
							) : null}
						</div>
					);
				}),
			)}
		</BoardPlate>
	);
}
