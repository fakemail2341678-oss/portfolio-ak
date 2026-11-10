import "@tanstack/react-start/server-only";
import { and, count, countDistinct, gte, isNotNull, isNull } from "drizzle-orm";
import { CHAAL_GAME_MODES, type ChaalOverview, isLocalMode } from "@/features/chaal/admin/schema";
import type { ChaalOverviewRange } from "@/features/chaal/admin/search";
import { addDays } from "@/lib/i18n/date-only";
import { chActivity, chConnection } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { activityPerDay, type DailyRow, noGames, storedDays } from "../daily";
import { healthState } from "./health";

/**
 * /admin/chaal (PLAN Task 84, decision 0274): the finished days from `ch_daily_stat`, today
 * from `ch_activity` as it stands, players over 7 and 30 days from the activity itself
 * (a player is counted once however many days they came), and the API's last 24 hours.
 * Days are UTC.
 */

const TREND_DAYS = 30;
const RANGE_DAYS: Readonly<Record<ChaalOverviewRange, number>> = { today: 1, "7d": 7, "30d": 30 };

const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10);

/** The last `days` days through `today`, oldest first, with the quiet ones. */
export function fillDays(rows: ReadonlyArray<DailyRow>, today: string, days: number): DailyRow[] {
	const byDay = new Map(rows.map((row) => [row.day, row]));
	return Array.from({ length: days }, (_, index) => {
		const day = addDays(today, index - days + 1);
		return (
			byDay.get(day) ?? {
				day,
				players: 0,
				connects: 0,
				games: noGames(),
				puzzles: 0,
				puzzlesSolved: 0,
				analyses: 0,
			}
		);
	});
}

const sum = (rows: ReadonlyArray<DailyRow>, of: (row: DailyRow) => number) =>
	rows.reduce((total, row) => total + of(row), 0);

const gamesOf = (row: DailyRow, local: boolean) =>
	CHAAL_GAME_MODES.filter((mode) => isLocalMode(mode) === local).reduce((total, mode) => total + row.games[mode], 0);

async function playersSince(db: Db, since: Date): Promise<number> {
	const [row] = await db
		.select({ players: countDistinct(chActivity.userId) })
		.from(chActivity)
		.where(and(gte(chActivity.at, since), isNotNull(chActivity.userId)));
	return row?.players ?? 0;
}

export async function getOverview(db: Db, range: ChaalOverviewRange, now: number = Date.now()): Promise<ChaalOverview> {
	const today = utcDay(now);
	const startOfToday = new Date(`${today}T00:00:00Z`);
	const [stored, live, week, month, [connected], health] = await Promise.all([
		storedDays(db, addDays(today, 1 - TREND_DAYS), today),
		activityPerDay(db, startOfToday, new Date(now)),
		playersSince(db, new Date(`${addDays(today, -6)}T00:00:00Z`)),
		playersSince(db, new Date(`${addDays(today, 1 - TREND_DAYS)}T00:00:00Z`)),
		db.select({ total: count() }).from(chConnection).where(isNull(chConnection.revokedAt)),
		healthState(db, "24h", now),
	]);
	// Today as it stands, not as the morning's rollup left it.
	const days = fillDays([...stored, ...live], today, TREND_DAYS);
	const inRange = days.slice(-RANGE_DAYS[range]);
	const modes = noGames();
	for (const mode of CHAAL_GAME_MODES) modes[mode] = sum(inRange, (row) => row.games[mode]);
	return {
		range,
		today,
		connected: connected?.total ?? 0,
		players: { week, month },
		totals: {
			games: Object.values(modes).reduce((total, value) => total + value, 0),
			puzzles: sum(inRange, (row) => row.puzzles),
			puzzlesSolved: sum(inRange, (row) => row.puzzlesSolved),
			analyses: sum(inRange, (row) => row.analyses),
			connects: sum(inRange, (row) => row.connects),
		},
		modes,
		days: days.map((row) => ({
			day: row.day,
			players: row.players,
			online: gamesOf(row, false),
			local: gamesOf(row, true),
			puzzles: row.puzzles,
			analyses: row.analyses,
		})),
		api: { ...health.totals, cooldown: health.cooldowns.public },
	};
}
