import type { CHAAL_BOARD_THEMES } from "../look/board-themes";
import type { CHAAL_PIECE_SETS } from "../settings/preferences";
import { FILES, isDarkSquare, type PieceCode, placementOf, RANKS, type Square } from "./fen";

/**
 * A static diagram of a position (PLAN 13.5, "Kit": `MiniBoard`): drawn on the server, no
 * JavaScript, nothing to load but the piece files. The home's hero uses it (Task 73); the
 * TV, games and studies use it from Task 74 on. It's a printed diagram: squares in the
 * board theme (hatched in "diagram"), the heavy double frame, the coordinates outside it,
 * and vermilion rings on the marked squares (the last move). Squares are HTML, not SVG, so
 * the board theme's tokens (a CSS pattern for the hatching) apply as they will on the board.
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
		<div
			{...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
			data-ch-board={theme === "diagram" ? undefined : theme}
			className={`grid ${coordinates ? "grid-cols-[0.875rem_1fr] grid-rows-[1fr_0.875rem] gap-x-2.5 gap-y-1.5" : ""} ${className ?? ""}`}
			data-testid="chaal-mini-board"
		>
			{coordinates ? (
				<div aria-hidden className="grid grid-rows-8 py-[10px] text-ch-muted text-xs leading-none">
					{ranks.map((rank) => (
						<span key={rank} className="flex items-center justify-center ch-figures">
							{rank}
						</span>
					))}
				</div>
			) : null}
			<div className="p-[5px]">
				<div className="ch-frame grid aspect-square grid-cols-8 grid-rows-8">
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
				</div>
			</div>
			{coordinates ? (
				<>
					<span aria-hidden />
					<div aria-hidden className="grid grid-cols-8 px-[10px] text-ch-muted text-xs leading-none">
						{files.map((file) => (
							<span key={file} className="text-center">
								{file}
							</span>
						))}
					</div>
				</>
			) : null}
		</div>
	);
}
