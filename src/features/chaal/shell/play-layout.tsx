import { ShrinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

/**
 * The play pages' layout (a game on Lichess, a local game; Task 78, decision 0267). Board
 * first: on a phone held upright the strips sit above and below the board and the controls
 * under it, within reach of a thumb. On a phone on its side (`land:`) the board's column
 * becomes two: the board, sized by the height left under the top bar, and beside it the
 * strips and the controls, so nothing needs a scroll. Zen hides the rest.
 */

/** The board's place: the container's width, and from `lg` the height left under the chrome. */
export const PLACE = "w-full lg:max-w-[calc(100dvh-15rem)]";

/** The board's column: the strips, the board and the controls. */
export const PLAY_COLUMN =
	"flex min-w-0 flex-col gap-1 land:grid land:grid-cols-[auto_minmax(0,1fr)] land:grid-rows-[auto_auto_1fr] land:items-start land:gap-x-4";

/** The board on its side: the first column, as tall as the screen allows. */
export const LAND_BOARD =
	"land:col-start-1 land:row-span-3 land:row-start-1 land:w-[calc(100dvh-5.5rem)] land:max-w-none";

/** Beside the board on its side: the strips and the controls. */
export const LAND_SIDE = "land:col-start-2 land:max-w-none";

/** A strip's place (with its row on a phone on its side added by the page). */
export const STRIP = `w-full px-4 sm:px-0 lg:max-w-[calc(100dvh-15rem)] ${LAND_SIDE}`;

/** The page's grid: the board's column and the side column from `lg`, one column in zen. */
export const playGrid = (zen: boolean) =>
	`mx-auto grid w-full max-w-7xl gap-x-8 gap-y-3 pt-2 pb-8 sm:px-6 lg:px-8 lg:pt-6 land:pb-2 ${zen ? "" : "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]"}`;

/** Zen's way out on a touch screen (the keyboard has `z`): a quiet button above the board. */
export function ZenExit({ onExit }: { onExit: () => void }) {
	return (
		<div className="mx-auto flex w-full max-w-7xl justify-end px-4 pt-2 sm:px-6 lg:px-8">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={onExit}
				className="text-ch-muted"
				data-testid="chaal-zen-exit"
			>
				<ShrinkIcon aria-hidden />
				{m.ch_zen_exit()}
			</Button>
		</div>
	);
}
