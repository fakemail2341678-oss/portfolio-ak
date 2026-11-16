import { createServerFn } from "@tanstack/react-start";
import { type StackPage, type StackStats, stackSearchSchema } from "@/features/stack/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireDev } from "@/middleware/dev";
import { getLocale } from "@/paraglide/runtime";
import { queryStack, slowStats } from "@/server/stack/query";

/**
 * Search, sort and paginate the stack. Uses the same schema as the /dev/stack URL,
 * so the server re-validates whatever the client sends. Dev-only, like the page.
 */
export const listStack = createServerFn({ method: "GET" })
	.middleware([requireDev])
	.validator(zodInput(stackSearchSchema))
	.handler(({ data }): StackPage => queryStack(data, getLocale()));

/** Deliberately slow, to demonstrate a deferred loader promise streamed via Suspense. */
export const getStackStats = createServerFn({ method: "GET" })
	.middleware([requireDev])
	.handler((): Promise<StackStats> => slowStats());
