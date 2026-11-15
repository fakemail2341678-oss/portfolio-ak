import { createServerFn } from "@tanstack/react-start";
import {
	checkinInputSchema,
	createHabitInputSchema,
	habitIdInputSchema,
	updateHabitInputSchema,
} from "@/features/apps/habits/schema";
import type { HabitDetail, HabitSummary, HabitsOverview } from "@/features/apps/habits/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireAppsUser, withAppsServices } from "@/middleware/apps";
import * as habits from "@/server/apps/habits/service";

/**
 * Habits (/apps/habits, decision 0193): any signed-in user, guests included
 * (`requireAppsUser`), each acting on their own habits only; the input validated with
 * the shared schema, then one call into the service.
 */

export const getHabitsOverview = createServerFn({ method: "GET" })
	.middleware([requireAppsUser, withAppsServices])
	.handler(({ context }): Promise<HabitsOverview> => habits.getOverview(context));

export const getHabit = createServerFn({ method: "GET" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(habitIdInputSchema))
	.handler(({ data, context }): Promise<HabitDetail> => habits.getHabit(context, data.id));

export const createHabit = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(createHabitInputSchema))
	.handler(({ data, context }): Promise<HabitSummary> => habits.createHabit(context, data));

export const updateHabit = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(updateHabitInputSchema))
	.handler(({ data, context }): Promise<void> => habits.updateHabit(context, data));

export const deleteHabit = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(habitIdInputSchema))
	.handler(({ data, context }): Promise<void> => habits.deleteHabit(context, data.id));

export const setHabitCheckin = createServerFn({ method: "POST" })
	.middleware([requireAppsUser, withAppsServices])
	.validator(zodInput(checkinInputSchema))
	.handler(({ data, context }): Promise<void> => habits.setCheckin(context, data));
