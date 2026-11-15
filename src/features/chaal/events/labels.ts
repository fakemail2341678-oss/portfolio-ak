import { formatDate, formatDateTime } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { formatTimeControl } from "../chess/lib/clock";
import { perfName } from "../players/labels";
import type { TournamentClock, TournamentStatus } from "./schema";

/** "3+2", "½+0": a tournament's clock, as a game's. */
export const tourPace = (clock: TournamentClock): string =>
	formatTimeControl({ initial: clock.limit, increment: clock.increment });

/** "Rated · Blitz · 3+2". */
export const tourKind = (tour: { rated: boolean; perf?: string; clock: TournamentClock }): string =>
	[
		tour.rated ? m.chaal_online_rated() : m.chaal_online_casual(),
		tour.perf ? perfName(tour.perf) : null,
		tourPace(tour.clock),
	]
		.filter(Boolean)
		.join(" · ");

/** When a tournament starts, ends or ended, in words. */
export function tourWhen(tour: { status: TournamentStatus; startsAt: number; finishesAt?: number }): string {
	if (tour.status === "created") return m.chaal_tournament_starts({ date: formatDateTime(tour.startsAt) });
	if (tour.status === "started")
		return tour.finishesAt
			? m.chaal_tournament_ends({ date: formatDateTime(tour.finishesAt) })
			: m.chaal_tournament_live();
	return m.chaal_tournament_finished_on({ date: formatDate(tour.finishesAt ?? tour.startsAt) });
}

/** The tournament's state, short: for a badge. */
export const STATUS_NAMES: Readonly<Record<TournamentStatus, () => string>> = {
	created: m.chaal_tournament_status_created,
	started: m.chaal_tournament_status_started,
	finished: m.chaal_tournament_status_finished,
};
