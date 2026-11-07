/**
 * Calendar dates without a time or time zone, stored as "YYYY-MM-DD".
 *
 * Date pickers work with local Date objects (midnight in the browser's zone);
 * converting through year/month/day parts, never through toISOString(),
 * prevents the classic off-by-one-day bug east or west of UTC.
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type IsoDate = string;

export const isIsoDate = (value: unknown): value is IsoDate => {
	if (typeof value !== "string") return false;
	const match = ISO_DATE.exec(value);
	if (!match) return false;
	const date = fromIsoDate(value);
	return date !== undefined && toIsoDate(date) === value;
};

/** Local Date -> "YYYY-MM-DD". */
export const toIsoDate = (date: Date): IsoDate =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** "YYYY-MM-DD" -> local Date at midnight, or undefined if malformed. */
export const fromIsoDate = (value: string | undefined): Date | undefined => {
	const match = value ? ISO_DATE.exec(value) : null;
	if (!match) return undefined;
	const [, year, month, day] = match;
	return new Date(Number(year), Number(month) - 1, Number(day));
};

/**
 * "YYYY-MM-DD" -> the instant to pass to formatDate(). Noon UTC lands on the same
 * calendar day in every time zone from UTC-11 to UTC+11 (Nepal is UTC+5:45).
 */
export const isoDateInstant = (value: IsoDate): Date => new Date(`${value}T12:00:00Z`);

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (positive east of UTC). */
const zoneOffset = (instant: number, timeZone: string): number => {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(new Date(instant));
	const field = (type: string) => Number(parts.find((part) => part.type === type)?.value);
	const asUtc = Date.UTC(
		field("year"),
		field("month") - 1,
		field("day"),
		field("hour"),
		field("minute"),
		field("second"),
	);
	return asUtc - (instant - (instant % 1000));
};

/** The instant a calendar day starts in `timeZone` ("2026-09-01" in Nepal -> 2026-08-31T18:15:00Z). */
export const startOfDayInZone = (value: IsoDate, timeZone: string): Date | undefined => {
	const match = ISO_DATE.exec(value);
	if (!match) return undefined;
	const [, year, month, day] = match;
	const midnightUtc = Date.UTC(Number(year), Number(month) - 1, Number(day));
	// Two passes: the offset at the guessed instant, then at the corrected one (DST edges).
	const first = midnightUtc - zoneOffset(midnightUtc, timeZone);
	return new Date(midnightUtc - zoneOffset(first, timeZone));
};

/**
 * An inclusive range of calendar days as instants: `start` is when `from` begins,
 * `end` (exclusive) is when the day after `to` begins. Either side may be open.
 */
export const dayRangeInZone = (
	from: IsoDate | undefined,
	to: IsoDate | undefined,
	timeZone: string,
): { start?: Date; end?: Date } => {
	const start = from ? startOfDayInZone(from, timeZone) : undefined;
	let end: Date | undefined;
	if (to) {
		const toStart = startOfDayInZone(to, timeZone);
		// The next calendar day, computed on the date (days can be 23 or 25 hours long).
		const next = toStart ? new Date(Date.UTC(...dateParts(to), 0) + 86_400_000) : undefined;
		end = next ? startOfDayInZone(next.toISOString().slice(0, 10), timeZone) : undefined;
	}
	return { ...(start ? { start } : {}), ...(end ? { end } : {}) };
};

const dateParts = (value: IsoDate): [number, number, number] => {
	const [year, month, day] = value.split("-").map(Number);
	return [year ?? 1970, (month ?? 1) - 1, day ?? 1];
};

/**
 * Today's calendar day in a time zone, as "YYYY-MM-DD" (en-CA formats dates that way).
 *
 * @public
 */
export const todayInZone = (timeZone: string, now: Date = new Date()): IsoDate =>
	new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** A calendar day moved by `days` (arithmetic at noon UTC, so no time zone or DST can shift it). */
export const addDays = (day: IsoDate, days: number): IsoDate =>
	new Date(isoDateInstant(day).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The day of the week of a calendar day: 0 is Sunday, 6 Saturday (as Date#getDay).
 *
 * @public
 */
export const weekdayOf = (day: IsoDate): number => isoDateInstant(day).getUTCDay();

/** A calendar month as "YYYY-MM". */
export type IsoMonth = string;

/** "2026-10" moved by `months` ("2026-01" − 1 is "2025-12"). */
export const addMonths = (month: IsoMonth, months: number): IsoMonth => {
	const [year = 1970, number = 1] = month.split("-").map(Number);
	const index = year * 12 + (number - 1) + months;
	return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

/**
 * The first and last calendar days of a month ("2024-02" -> 2024-02-01, 2024-02-29).
 *
 * @public
 */
export const monthDays = (month: IsoMonth): { first: IsoDate; last: IsoDate } => ({
	first: `${month}-01`,
	last: addDays(`${addMonths(month, 1)}-01`, -1),
});
