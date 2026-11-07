import { createServerFn } from "@tanstack/react-start";
import { type StackPage, type StackStats, stackSearchSchema } from "@/features/stack/schema";
import { zodInput } from "@/functions/_lib/validator";
import { devOnlyMiddleware } from "@/middleware/dev";
import { getLocale } from "@/paraglide/runtime";
import { STACK } from "@/server/stack/data";
import { queryStack } from "@/server/stack/query";

/**
 * Search, sort and paginate the stack. Uses the same schema as the /dev/stack URL,
 * so the server re-validates whatever the client sends. Dev-only, like the page.
 */
export const listStack = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(stackSearchSchema))
	.handler(({ data }): StackPage => {
		if (data.simulate === "error") {
			// Deliberately leaky message: errorNormalizationMiddleware must hide it from the client.
			throw new Error("Simulated failure: connection to 10.0.0.5:5432 refused (password=hunter2)");
		}
		return queryStack(data, getLocale());
	});

/** Deliberately slow, to demonstrate a deferred loader promise streamed via Suspense. */
export const getStackStats = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware])
	.handler(async (): Promise<StackStats> => {
		await new Promise((resolve) => setTimeout(resolve, 800));
		return { tools: STACK.length, categories: new Set(STACK.map((entry) => entry.category)).size };
	});
