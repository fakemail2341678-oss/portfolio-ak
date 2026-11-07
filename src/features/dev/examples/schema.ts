import { z } from "zod";
import { bulkIdsSchema, type Paged } from "@/lib/list/paging";
import { booleanParam, enumParam, pageParam, searchParam } from "@/lib/list/params";
import { email, required } from "@/lib/validation";

/**
 * The dev examples' data: a small in-memory task list on the dev server
 * (src/server/examples/tasks.ts), shared by the filters, DataTable and
 * optimistic-update examples. Nothing here touches the database.
 */

export const EXAMPLE_PRIORITIES = ["low", "medium", "high"] as const;
export type ExamplePriority = (typeof EXAMPLE_PRIORITIES)[number];

export const EXAMPLE_SORTS = ["-created", "created", "title", "-title"] as const;

export const EXAMPLE_PAGE_SIZE = 6;

export type ExampleTask = {
	id: string;
	title: string;
	priority: ExamplePriority;
	done: boolean;
	createdAt: string;
};

export type ExampleTaskPage = Paged<ExampleTask>;

/** URL search of the list examples (and the list function's input). Invalid values are corrected. */
export const exampleTaskSearchSchema = z.object({
	q: searchParam(),
	priority: enumParam(["all", ...EXAMPLE_PRIORITIES], "all"),
	done: booleanParam(),
	sort: enumParam(EXAMPLE_SORTS, "-created"),
	page: pageParam(),
});
export type ExampleTaskSearch = z.output<typeof exampleTaskSearchSchema>;

export const EXAMPLE_SEARCH_DEFAULTS = { q: "", priority: "all", sort: "-created", page: 1 } as const;

export const exampleTaskIdSchema = z.object({ id: z.uuid() });

export const exampleTasksDoneSchema = bulkIdsSchema().extend({
	done: z.boolean(),
	/** Makes the server refuse the change: shows the optimistic rollback. */
	fail: z.boolean().default(false),
});

/** The forms example's server-validated sign-up. */
export const exampleSignupSchema = z.object({ username: required({ max: 32 }), email: email() });

/** The contact form recipe. `website` is the honeypot; `captcha` the Turnstile token when configured. */
export const exampleContactSchema = z.object({
	name: required({ max: 80 }),
	email: email(),
	message: required({ max: 2000 }),
	website: z.string().max(200).optional(),
	captcha: z.string().max(2048).optional(),
});
export type ExampleContactInput = z.output<typeof exampleContactSchema>;

/** The background-jobs recipe: how often its flaky step fails before succeeding (4 is past the 3 retries). */
export const exampleJobSchema = z.object({ failures: z.number().int().min(0).max(4) });

/** Error cases the errors example can trigger on the server. */
export const EXAMPLE_ERROR_CASES = ["forbidden", "not-found", "crash"] as const;
export type ExampleErrorCase = (typeof EXAMPLE_ERROR_CASES)[number];
export const exampleErrorSchema = z.object({ case: z.enum(EXAMPLE_ERROR_CASES) });

/** Idempotency example: a message to send, with the key the form made when it opened (none: every call sends). */
export const exampleMessageSchema = z.object({
	text: required({ max: 80 }),
	key: z.uuid().optional(),
});
