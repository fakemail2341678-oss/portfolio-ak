import { AsyncQueuer } from "@tanstack/pacer/async-queuer";

/** Adds a job to a queue and resolves or rejects with the job's own result. */
export type JobQueue = <T>(job: () => Promise<T>) => Promise<T>;

/**
 * A queue that runs `concurrency` jobs at a time, in the order they were added (TanStack
 * Pacer's `AsyncQueuer`, decision 0299), and gives every job its own promise:
 *
 *   const queued = createJobQueue(3);
 *   const image = await queued(() => upload(file));
 *
 * A job that rejects rejects its own promise and nothing else: the next one starts. Uploads
 * go three at a time through one (`uploadImage`), and Chaal's Lichess lanes are queues of
 * one (`createLanes`).
 */
export function createJobQueue(concurrency: number): JobQueue {
	// The queued item is the job with its promise attached: it never rejects, so the queue never stops.
	const queue = new AsyncQueuer<() => Promise<void>>((run) => run(), { concurrency });
	return <T>(job: () => Promise<T>) =>
		new Promise<T>((resolve, reject) => {
			queue.addItem(() =>
				// A job that throws before returning a promise still rejects its own promise.
				new Promise<T>((done) => done(job())).then(resolve, reject),
			);
			// Pacer 0.23.1 starts a job added while another runs only when one finishes, so a queue
			// of three would run one upload, then three. A free slot is filled now: stopping and
			// starting makes the queue look at its slots again (the running jobs are not touched).
			const { activeItems, items } = queue.store.state;
			if (activeItems.length < concurrency && items.length > 0) {
				queue.stop();
				queue.start();
			}
		});
}
