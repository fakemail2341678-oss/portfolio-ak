import { m } from "@/paraglide/messages";
import { type Color, materialBalance, opposite } from "../chess/rules";
import { sideName } from "../chess/speech";
import type { CHAAL_PIECE_SETS } from "../settings/preferences";

/** Keys for repeated pieces: "p1", "p2", "n1". */
function counted(types: ReadonlyArray<string>): string[] {
	const seen = new Map<string, number>();
	return types.map((type) => {
		const count = (seen.get(type) ?? 0) + 1;
		seen.set(type, count);
		return `${type}${count}`;
	});
}

/**
 * What a side has won (PLAN 13.5, `Material`): the opponent's pieces it's ahead by, small,
 * and its lead in points ("+3"). Nothing when it's even.
 */
export function Material({
	fen,
	color,
	pieces = "cburnett",
}: {
	fen: string;
	color: Color;
	pieces?: (typeof CHAAL_PIECE_SETS)[number];
}) {
	const side = materialBalance(fen)[color];
	if (side.pieces.length === 0 && side.points === 0) return null;
	const theirs = opposite(color) === "white" ? "w" : "b";
	return (
		<span className="inline-flex items-center gap-1" data-testid="chaal-material">
			<span aria-hidden className="flex">
				{counted(side.pieces).map((key) => (
					<img
						key={key}
						src={`/chaal/pieces/${pieces}/${theirs}${key[0]?.toUpperCase()}.svg`}
						alt=""
						width={16}
						height={16}
						className="-ml-1 size-4 first:ml-0"
					/>
				))}
			</span>
			{side.points > 0 ? (
				<>
					<span aria-hidden className="ch-figures font-semibold text-ch-ink">
						+{side.points}
					</span>
					<span className="sr-only">{m.ch_material_up({ side: sideName(color), points: side.points })}</span>
				</>
			) : null}
		</span>
	);
}
