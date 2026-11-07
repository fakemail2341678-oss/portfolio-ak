import "@tanstack/react-start/server-only";

/**
 * The background-jobs recipe's shape, in process (docs/guides/recipes.md,
 * "Background jobs"; decision 0145): a job is a list of named steps, each step
 * retried with exponential backoff, and a finished step never runs again.
 * Workflow DevKit (`"use step"`), Inngest (`step.run`) and Trigger.dev work the
 * same way, durably: they persist each step's result, so a crash or redeploy
 * resumes after the last finished step. This in-memory runner only shows the
 * semantics; it doesn't survive the request, so never use it for real work.
 */
export type StepLog = { step: string; attempt: number; outcome: "ok" | "failed"; delayMs: number };

export async function runSteps(
	steps: ReadonlyArray<{ name: string; run: (attempt: number) => Promise<void> }>,
	{ retries = 3, baseDelayMs = 50, sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) } = {},
): Promise<{ ok: boolean; log: StepLog[] }> {
	const log: StepLog[] = [];
	for (const step of steps) {
		let done = false;
		for (let attempt = 1; attempt <= retries + 1 && !done; attempt += 1) {
			const delayMs = attempt === 1 ? 0 : baseDelayMs * 2 ** (attempt - 2);
			if (delayMs) await sleep(delayMs);
			try {
				await step.run(attempt);
				log.push({ step: step.name, attempt, outcome: "ok", delayMs });
				done = true;
			} catch {
				log.push({ step: step.name, attempt, outcome: "failed", delayMs });
			}
		}
		// Out of retries: the job stops here (a durable runner would mark it failed and alert).
		if (!done) return { ok: false, log };
	}
	return { ok: true, log };
}

/** The example job: three steps, the second fails `failures` times before it succeeds. */
export const runExampleJob = (failures: number, options?: Parameters<typeof runSteps>[1]) =>
	runSteps(
		[
			{ name: "load-recipients", run: async () => {} },
			{
				name: "send-email-batch",
				run: async (attempt) => {
					if (attempt <= failures) throw new Error("Provider timeout (simulated)");
				},
			},
			{ name: "record-sent", run: async () => {} },
		],
		options,
	);
