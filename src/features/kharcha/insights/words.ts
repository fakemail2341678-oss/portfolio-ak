import type { IsoMonth } from "@/lib/i18n/date-only";
import { formatMonthYear } from "@/lib/i18n/intl";

/** "November 2026" from "2026-11" (Task 94). */
export const monthLabel = (month: IsoMonth): string =>
	formatMonthYear(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15));
