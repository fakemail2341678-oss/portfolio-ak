import { createServerFn } from "@tanstack/react-start";
import {
	type ExampleTaskPage,
	exampleContactSchema,
	exampleErrorSchema,
	exampleJobSchema,
	exampleMessageSchema,
	exampleSignupSchema,
	exampleTaskIdSchema,
	exampleTaskSearchSchema,
	exampleTasksDoneSchema,
} from "@/features/dev/examples/schema";
import { zodInput } from "@/functions/_lib/validator";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requireDev } from "@/middleware/dev";
import { db } from "@/server/db/client";
import { submitContact } from "@/server/examples/contact";
import * as demos from "@/server/examples/demos";
import { listMessages, sendMessage } from "@/server/examples/idempotency";
import { runExampleJob } from "@/server/examples/jobs";
import { deleteTasks, listTasks, nextSnapshot } from "@/server/examples/tasks";
import { publicFormGuards } from "@/server/http/turnstile";

/**
 * Server functions behind the /dev/examples pages. Every one runs
 * requireDev: in a production build they answer NOT_FOUND. The
 * permission example's functions are in examples-permissions.ts.
 */

/** Loader + Query: each call counts, so a refetch after hydration would show. */
export const getExampleSnapshot = createServerFn({ method: "GET" })
	.middleware([requireDev])
	.handler(() => nextSnapshot());

/** Streaming: deliberately slow, so the page streams its fallback first. */
export const getSlowExample = createServerFn({ method: "GET" })
	.middleware([requireDev])
	.handler(() => demos.slowExample());

export const listExampleTasks = createServerFn({ method: "GET" })
	.middleware([requireDev])
	.validator(zodInput(exampleTaskSearchSchema))
	.handler(({ data }): ExampleTaskPage => listTasks(data));

/** One task, for the masking example's full page. Missing: NOT_FOUND. */
export const getExampleTask = createServerFn({ method: "GET" })
	.middleware([requireDev])
	.validator(zodInput(exampleTaskIdSchema))
	.handler(({ data }) => demos.taskOrNotFound(data.id));

/** Marks tasks done or not; `fail` makes it refuse (after a delay), to show the optimistic rollback. */
export const setExampleTasksDone = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.validator(zodInput(exampleTasksDoneSchema))
	.handler(({ data }) => demos.markTasksDone(data));

export const deleteExampleTasks = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data }) => ({ deleted: deleteTasks(data.ids) }));

export const resetExampleTasks = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.handler(() => demos.resetTaskList());

/** Forms: the same schema as the client, plus a rule only the server knows (taken usernames). */
export const submitExampleSignup = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.validator(zodInput(exampleSignupSchema))
	.handler(({ data }) => demos.signUp(data));

/** Errors: throws what the example asks for. Its crash, which is no AppError, reaches the client as INTERNAL. */
export const getExampleFailure = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.validator(zodInput(exampleErrorSchema))
	.handler(({ data }): never => demos.fail(data));

/** Idempotency: the messages sent so far. */
export const listExampleMessages = createServerFn({ method: "GET" })
	.middleware([requireDev])
	.handler(() => listMessages());

/** Idempotency: sends once per key (repeats answer with the first message, `replayed: true`). */
export const sendExampleMessage = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.validator(zodInput(exampleMessageSchema))
	.handler(({ data }) => sendMessage(data));

export const resetExampleMessages = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.handler(() => demos.resetMessageList());

/** Contact form recipe: honeypot, Turnstile when configured, a database-backed rate limit per IP. */
export const submitExampleContact = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.validator(zodInput(exampleContactSchema))
	.handler(({ data }) => submitContact(db, data, publicFormGuards()));

/** Background jobs recipe: runs the example job in process, the second step failing `failures` times. */
export const startExampleJob = createServerFn({ method: "POST" })
	.middleware([requireDev])
	.validator(zodInput(exampleJobSchema))
	.handler(({ data }) => runExampleJob(data.failures));
