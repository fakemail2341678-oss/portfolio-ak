import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AnimeWeekData } from "@/features/parda/schedule/types";
import { zodInput } from "@/functions/_lib/validator";
import { withPardaCatalog } from "@/middleware/parda";
import { locales } from "@/paraglide/runtime";
import { viewerToday } from "@/server/parda/catalog/context";
import { animeWeek } from "@/server/parda/catalog/schedule";

/**
 * The schedule's half for everyone (Task 68, decision 0241): anime airing in the week
 * from today in the viewer's zone. Starts with `withPardaCatalog`, so takedowns and a
 * kids' cap apply in catalog/service.ts.
 */

export const getPardaAnimeWeek = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(z.strictObject({ locale: z.enum(locales) })))
	.handler(async ({ data, context }): Promise<AnimeWeekData> => {
		if (!context.catalog) return { configured: false };
		const today = viewerToday();
		return { configured: true, today, ...(await animeWeek(context.catalog, data.locale, today)) };
	});
