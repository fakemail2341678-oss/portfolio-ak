import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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
import { AppError } from "@/lib/errors";
import { bulkIdsSchema } from "@/lib/list/paging";
import { devOnlyMiddleware } from "@/middleware/dev";
import { m } from "@/paraglide/messages";
import { trustedClientIp } from "@/server/auth/client-ip";
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/env";
import { submitContact } from "@/server/examples/contact";
import { listMessages, resetMessages, sendMessage } from "@/server/examples/idempotency";
import { runExampleJob } from "@/server/examples/jobs";
import { deleteTasks, getTask, listTasks, nextSnapshot, resetTasks, setTasksDone } from "@/server/examples/tasks";
import { verifyTurnstile } from "@/server/http/turnstile";

/**
 * Server functions behind the /dev/examples pages. Every one runs
 * devOnlyMiddleware: in a production build they answer NOT_FOUND. The
 * permission example's functions are in examples-permissions.ts.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Loader + Query: each call counts, so a refetch after hydration would show. */
export const getExampleSnapshot = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware])
	.handler(() => nextSnapshot());

/** Streaming: deliberately slow, so the page streams its fallback first. */
export const getSlowExample = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware])
	.handler(async () => {
		const started = Date.now();
		await sleep(1500);
		return { tookMs: Date.now() - started, finishedAt: new Date().toISOString() };
	});

export const listExampleTasks = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(exampleTaskSearchSchema))
	.handler(({ data }): ExampleTaskPage => listTasks(data));

/** One task, for the masking example's full page. Missing: NOT_FOUND. */
export const getExampleTask = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(exampleTaskIdSchema))
	.handler(({ data }) => {
		const task = getTask(data.id);
		if (!task) throw new AppError("NOT_FOUND", "No such example task");
		return task;
	});

/** Marks tasks done or not; `fail` makes it refuse (after a delay), to show the optimistic rollback. */
export const setExampleTasksDone = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(exampleTasksDoneSchema))
	.handler(async ({ data }) => {
		await sleep(600);
		if (data.fail) throw new AppError("CONFLICT", "Simulated failure (examples)");
		return { updated: setTasksDone(data.ids, data.done) };
	});

export const deleteExampleTasks = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data }) => ({ deleted: deleteTasks(data.ids) }));

export const resetExampleTasks = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.handler(() => {
		resetTasks();
		return { ok: true };
	});

/** Forms: the same schema as the client, plus a rule only the server knows (taken usernames). */
export const submitExampleSignup = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(exampleSignupSchema))
	.handler(({ data }) => {
		if (["admin", "root", "taken"].includes(data.username.toLowerCase())) {
			throw new AppError("CONFLICT", "Username taken (examples)", {
				fieldErrors: { username: [m.examples_forms_username_taken()] },
			});
		}
		return { username: data.username };
	});

/** Errors: throws what the example asks for. A plain Error reaches the client as INTERNAL. */
export const failExample = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(exampleErrorSchema))
	.handler(({ data }): never => {
		if (data.case === "forbidden") throw new AppError("FORBIDDEN", "Example refusal");
		if (data.case === "not-found") throw new AppError("NOT_FOUND", "Example missing record");
		throw new Error("Example crash: details stay in the server log");
	});

/** Idempotency: the messages sent so far. */
export const listExampleMessages = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware])
	.handler(() => listMessages());

/** Idempotency: sends once per key (repeats answer with the first message, `replayed: true`). */
export const sendExampleMessage = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(exampleMessageSchema))
	.handler(({ data }) => sendMessage(data));

export const resetExampleMessages = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.handler(() => {
		resetMessages();
		return { ok: true };
	});

/** Contact form recipe: honeypot, Turnstile when configured, a database-backed rate limit per IP. */
export const submitExampleContact = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(exampleContactSchema))
	.handler(({ data }) => {
		const ip = trustedClientIp(getRequest());
		const secret = serverEnv.TURNSTILE_SECRET_KEY;
		return submitContact(db, data, {
			ip,
			verifyCaptcha: secret ? (token) => verifyTurnstile(secret, token, ip) : null,
		});
	});

/** Background jobs recipe: runs the example job in process, the second step failing `failures` times. */
export const runExampleJobFn = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(exampleJobSchema))
	.handler(({ data }) => runExampleJob(data.failures));
