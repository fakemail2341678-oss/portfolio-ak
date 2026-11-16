import "@tanstack/react-start/server-only";
import type { z } from "zod";
import type { exampleErrorSchema, exampleSignupSchema, exampleTasksDoneSchema } from "@/features/dev/examples/schema";
import { DEV_ROUTES } from "@/lib/dev-routes";
import { AppError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { resetMessages } from "./idempotency";
import { getTask, resetTasks, setTasksDone } from "./tasks";

/**
 * What the /dev/examples functions do beyond calling a store (src/functions/examples.ts):
 * the slow answer, the refusals and the crash each example shows on purpose.
 */

// timer: sleeps, because the examples answer slowly on purpose.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A failure nobody planned for, for the errors example: not an AppError, so it must arrive as INTERNAL. */
export class ExampleCrash extends Error {
	override name = "ExampleCrash";
}

/** Streaming: deliberately slow, so the page streams its fallback first. */
export async function slowExample() {
	const started = Date.now();
	await sleep(1500);
	return { tookMs: Date.now() - started, finishedAt: new Date().toISOString() };
}

/** One task, for the masking example's full page. Missing: NOT_FOUND. */
export function taskOrNotFound(id: string) {
	const task = getTask(id);
	if (!task) throw new AppError("NOT_FOUND", "No such example task");
	return task;
}

/** Marks tasks done or not; `fail` makes it refuse (after a delay), to show the optimistic rollback. */
export async function markTasksDone(input: z.output<typeof exampleTasksDoneSchema>) {
	await sleep(600);
	if (input.fail) throw new AppError("CONFLICT", "Simulated failure (examples)");
	return { updated: setTasksDone(input.ids, input.done) };
}

export function resetTaskList() {
	resetTasks();
	return { ok: true };
}

/** Forms: a rule only the server knows (taken usernames), answered on the field. */
export function signUp(input: z.output<typeof exampleSignupSchema>) {
	if (["admin", "root", "taken"].includes(input.username.toLowerCase())) {
		throw new AppError("CONFLICT", "Username taken (examples)", {
			fieldErrors: { username: [m.examples_forms_username_taken()] },
		});
	}
	return { username: input.username };
}

/** Errors: throws what the example asks for. The crash reaches the client as INTERNAL, with nothing of its message. */
export function fail(input: z.output<typeof exampleErrorSchema>): never {
	if (input.case === "forbidden") throw new AppError("FORBIDDEN", "Example refusal");
	if (input.case === "not-found") throw new AppError("NOT_FOUND", "Example missing record");
	throw new ExampleCrash("Example crash: details stay in the server log");
}

export function resetMessageList() {
	resetMessages();
	return { ok: true };
}

/**
 * Permissions: what a guarded example answers once `requirePermission` has let the call
 * through. Dev only, like its page: NOT_FOUND in a plain build.
 */
export function ping() {
	if (!DEV_ROUTES) throw new AppError("NOT_FOUND", "Not found");
	return { ok: true, at: new Date().toISOString() };
}
