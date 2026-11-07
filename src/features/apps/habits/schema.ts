import { z } from "zod";
import { formatNumber } from "@/lib/i18n/intl";
import { isoDate, numberRange, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { APP_COLORS } from "../colors";
import { EVERY_DAY, HABIT_TARGET_MAX } from "./types";

/**
 * Habits' inputs (decision 0193), checked on the server and by the dialog. Ids of new
 * habits come from the browser (`crypto.randomUUID()`).
 */
const id = z.uuid();

export const HABIT_NAME_MAX = 60;

const days = () =>
	z
		.number()
		.int()
		.min(1, { error: () => m.habits_error_days() })
		.max(EVERY_DAY);
const target = () => numberRange({ min: 1, max: HABIT_TARGET_MAX, integer: true });

export const createHabitInput = z.strictObject({
	id,
	name: required({ max: HABIT_NAME_MAX }),
	color: z.enum(APP_COLORS),
	days: days(),
	target: target(),
});

export const updateHabitInput = z.strictObject({
	id,
	name: required({ max: HABIT_NAME_MAX }).optional(),
	color: z.enum(APP_COLORS).optional(),
	days: days().optional(),
	target: target().optional(),
	archived: z.boolean().optional(),
});

export const habitIdInput = z.strictObject({ id });

/** A day's count for a habit; 0 removes the check-in. */
export const checkinInput = z.strictObject({
	habitId: id,
	day: isoDate(),
	count: z
		.number()
		.int()
		.min(0)
		.max(HABIT_TARGET_MAX, { error: () => m.validation_number_max({ max: formatNumber(HABIT_TARGET_MAX) }) }),
});

/** The dialog's form: days as weekday numbers ("0" Sunday … "6" Saturday). */
export const habitFormSchema = z.object({
	name: required({ max: HABIT_NAME_MAX }),
	color: z.enum(APP_COLORS),
	weekdays: z.array(z.string()).min(1, { error: () => m.habits_error_days() }),
	target: target(),
});
export type HabitFormValues = z.input<typeof habitFormSchema>;

export type CreateHabitInput = z.infer<typeof createHabitInput>;
export type UpdateHabitInput = z.infer<typeof updateHabitInput>;
export type CheckinInput = z.infer<typeof checkinInput>;
