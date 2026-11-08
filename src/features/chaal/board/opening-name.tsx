import { m } from "@/paraglide/messages";
import type { ChaalOpening } from "../schema";

/**
 * The opening (PLAN 13.5's kit, `OpeningName`; Task 75): its ECO code and name as Lichess's
 * explorer gives them. Names stay in English in both languages (PLAN 13.6: "opening names
 * stay as Lichess gives them"), marked so a screen reader reads them as English. One line,
 * always there, so nothing moves when a name arrives; `null` says the position isn't a
 * named opening.
 */
export function OpeningName({
	opening,
	pending = false,
	className,
}: {
	opening: ChaalOpening | null;
	/** The name is on its way: the line keeps its place, empty. */
	pending?: boolean;
	className?: string;
}) {
	return (
		<p
			className={`flex min-h-6 items-baseline gap-2 truncate text-sm ${className ?? ""}`}
			data-testid="chaal-opening"
			aria-live="polite"
		>
			{opening ? (
				<>
					<span className="ch-figures shrink-0 font-semibold">{opening.eco}</span>
					<span lang="en" dir="ltr" className="truncate" title={opening.name}>
						{opening.name}
					</span>
				</>
			) : pending ? null : (
				<span className="text-ch-muted">{m.ch_opening_none()}</span>
			)}
		</p>
	);
}
