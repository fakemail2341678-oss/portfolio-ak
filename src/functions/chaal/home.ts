import { createServerFn } from "@tanstack/react-start";
import type { ChaalHome } from "@/features/chaal/home/curation";
import { withChaalPublic } from "@/middleware/chaal";
import { chaalHome } from "@/server/chaal/home";

/**
 * The home's curated sections (Task 84, decision 0274): the order, what's featured today and
 * the announcement, read through the controls' cache. Public: starts with `withChaalPublic`.
 */

export const getChaalHome = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.handler(({ context }): Promise<ChaalHome> => chaalHome(context.chaal.controls));
