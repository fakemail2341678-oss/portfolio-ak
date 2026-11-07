import { z } from "zod";
import { enumParam } from "@/lib/list/params";

/** /apps/habits: the habits in use, or the archived ones. */
export const habitsSearchSchema = z.object({ view: enumParam(["active", "archived"] as const, "active") });
export type HabitsSearch = z.output<typeof habitsSearchSchema>;

/** A habit's page: its id (a UUID), or no match at all. */
export const habitParamsSchema = z.object({ habitId: z.uuid() });
