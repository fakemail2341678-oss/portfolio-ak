import "@tanstack/react-start/server-only";
import { and, asc, desc, gte, lt, sql } from "drizzle-orm";
import { CHAAL_GAME_MODES, type ChaalGameMode } from "@/features/chaal/admin/schema";
import { chActivity, chDailyStat, chPuzzleAttempt } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { ACTIVITY_DAYS } from "./activity";

/**
 * The overview's rollup (PLAN Task 84, decision 0274): `ch_activity` and the solved puzzles
 * of `ch_puzzle_attempt` per UTC day into `ch_daily_stat`, which outlives the activity's 90
 * days. The daily job runs it before the prune.
 */

const DAY_MS = 86_400_000;

export type DailyRow = {
	day: string;
	players: number;
	connects: number;
	games: Record<ChaalGameMode, number>;
	puzzles: number;
	puzzlesSolved: number;
	analyses: number;
};

const counted = (filter: ReturnType<typeof sql>) => sql<number>`(count(*) filter (where ${filter}))::int`;
const dayOf = (column: typeof chActivity.at | typeof chPuzzleAttempt.at) =>
	sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD')`;

export const noGames = (): Record<ChaalGameMode, number> =>
	Object.fromEntries(CHAAL_GAME_MODES.map((mode) => [mode, 0])) as Record<ChaalGameMode, number>;

/** Each day's activity from `since`, up to `until`, oldest first. */
export async function activityPerDay(db: Db, since: Date, until: Date): Promise<DailyRow[]> {
	const window = (column: typeof chActivity.at | typeof chPuzzleAttempt.at) =>
		sql`${column} >= ${since} and ${column} < ${until}`;
	const [rows, solved] = await Promise.all([
		db
			.select({
				day: dayOf(chActivity.at),
				players: sql<number>`(count(distinct ${chActivity.userId}))::int`,
				connects: counted(sql`${chActivity.kind} = 'connect'`),
				puzzles: counted(sql`${chActivity.kind} = 'puzzle'`),
				analyses: counted(sql`${chActivity.kind} = 'analysis'`),
				ai: counted(sql`${chActivity.kind} = 'game' and ${chActivity.mode} = 'ai'`),
				challenge: counted(sql`${chActivity.kind} = 'game' and ${chActivity.mode} = 'challenge'`),
				seek: counted(sql`${chActivity.kind} = 'game' and ${chActivity.mode} = 'seek'`),
				lichess: counted(sql`${chActivity.kind} = 'game' and ${chActivity.mode} = 'lichess'`),
				localEngine: counted(sql`${chActivity.kind} = 'game' and ${chActivity.mode} = 'local-engine'`),
				localBoard: counted(sql`${chActivity.kind} = 'game' and ${chActivity.mode} = 'local-board'`),
			})
			.from(chActivity)
			.where(window(chActivity.at))
			// By position: every value in a `sql` template is its own parameter, so the expression would not match (apps.md).
			.groupBy(sql`1`)
			.orderBy(sql`1`),
		db
			.select({ day: dayOf(chPuzzleAttempt.at), solved: counted(sql`${chPuzzleAttempt.won}`) })
			.from(chPuzzleAttempt)
			.where(window(chPuzzleAttempt.at))
			.groupBy(sql`1`),
	]);
	const solvedOn = new Map(solved.map((row) => [row.day, row.solved]));
	const days = new Set([...rows.map((row) => row.day), ...solvedOn.keys()]);
	const byDay = new Map(rows.map((row) => [row.day, row]));
	return [...days].sort().map((day) => {
		const row = byDay.get(day);
		return {
			day,
			players: row?.players ?? 0,
			connects: row?.connects ?? 0,
			games: {
				ai: row?.ai ?? 0,
				challenge: row?.challenge ?? 0,
				seek: row?.seek ?? 0,
				lichess: row?.lichess ?? 0,
				"local-engine": row?.localEngine ?? 0,
				"local-board": row?.localBoard ?? 0,
			},
			puzzles: row?.puzzles ?? 0,
			puzzlesSolved: solvedOn.get(day) ?? 0,
			analyses: row?.analyses ?? 0,
		};
	});
}

/**
 * Rolls up every day since the last one stored (that day again, as it may have been
 * partial), so a missed run fills in, through to now. Running it twice in a day replaces
 * today's row. Returns how many days were written.
 */
export async function rollupDaily(db: Db, now: number = Date.now()): Promise<number> {
	const cutoff = new Date(now - ACTIVITY_DAYS * DAY_MS);
	const [latest] = await db.select({ day: chDailyStat.day }).from(chDailyStat).orderBy(desc(chDailyStat.day)).limit(1);
	const from = latest ? new Date(`${latest.day}T00:00:00Z`) : cutoff;
	const rows = await activityPerDay(db, from < cutoff ? cutoff : from, new Date(now));
	const updatedAt = new Date(now);
	for (const row of rows) {
		const { day, ...figures } = row;
		await db
			.insert(chDailyStat)
			.values({ ...row, updatedAt })
			.onConflictDoUpdate({ target: chDailyStat.day, set: { ...figures, updatedAt } });
	}
	return rows.length;
}

/** The stored days from `day` up to (not including) `before`, oldest first. */
export async function storedDays(db: Db, day: string, before: string): Promise<DailyRow[]> {
	const rows = await db
		.select()
		.from(chDailyStat)
		.where(and(gte(chDailyStat.day, day), lt(chDailyStat.day, before)))
		.orderBy(asc(chDailyStat.day));
	return rows.map(({ updatedAt: _updatedAt, games, ...row }) => ({ ...row, games: { ...noGames(), ...games } }));
}
