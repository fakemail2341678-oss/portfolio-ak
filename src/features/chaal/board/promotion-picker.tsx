import { useEffect, useRef } from "react";
import { m } from "@/paraglide/messages";
import type { Color, Promotion } from "../chess/rules";
import { pieceWord } from "../chess/speech";
import type { CHAAL_PIECE_SETS } from "../settings/preferences";

const CHOICES: ReadonlyArray<Promotion> = ["q", "n", "r", "b"];

/**
 * The piece a pawn becomes (PLAN 13.5, `PromotionPicker`): four squares stacked from the
 * promotion square, over a veil that cancels the move. Focus starts on the queen; ↑/↓ move
 * between the pieces, Escape cancels. Players who never want to choose turn on auto-queen.
 */
export function PromotionPicker({
	color,
	col,
	fromTop,
	pieces = "cburnett",
	onPick,
	onCancel,
}: {
	color: Color;
	/** The promotion square's column as drawn (0–7). */
	col: number;
	/** The promotion square is on the top row as drawn, so the choices stack down from it. */
	fromTop: boolean;
	pieces?: (typeof CHAAL_PIECE_SETS)[number];
	onPick: (promotion: Promotion) => void;
	onCancel: () => void;
}) {
	const first = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		first.current?.focus();
	}, []);
	const side = color === "white" ? "w" : "b";
	return (
		<div
			className="absolute inset-0 z-20"
			data-testid="chaal-promotion"
			// The board under it mustn't read these presses as moves.
			onPointerDown={(event) => event.stopPropagation()}
			onPointerUp={(event) => event.stopPropagation()}
		>
			<button
				type="button"
				tabIndex={-1}
				aria-label={m.ch_promotion_cancel()}
				onClick={onCancel}
				className="absolute inset-0 size-full bg-ch-paper/70"
			/>
			<fieldset
				aria-label={m.ch_promotion_title()}
				className={`absolute flex w-[12.5%] ${fromTop ? "top-0 flex-col" : "bottom-0 flex-col-reverse"}`}
				style={{ left: `${col * 12.5}%` }}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						onCancel();
						return;
					}
					if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
					event.preventDefault();
					const buttons = [...event.currentTarget.querySelectorAll("button")];
					const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
					const step = (event.key === "ArrowDown") === fromTop ? 1 : -1;
					buttons[(at + step + buttons.length) % buttons.length]?.focus();
				}}
			>
				{CHOICES.map((choice, index) => (
					<button
						key={choice}
						ref={index === 0 ? first : undefined}
						type="button"
						aria-label={pieceWord(choice)}
						onClick={() => onPick(choice)}
						className="aspect-square w-full border-2 border-ch-frame bg-ch-paper outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--ch-sq-mark)]"
						data-promotion={choice}
					>
						<img
							src={`/chaal/pieces/${pieces}/${side}${choice.toUpperCase()}.svg`}
							alt=""
							width={45}
							height={45}
							draggable={false}
							className="size-full select-none"
						/>
					</button>
				))}
			</fieldset>
		</div>
	);
}
