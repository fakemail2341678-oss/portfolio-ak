import "@tanstack/react-start/server-only";
import { AppError } from "@/lib/errors";

/**
 * Idempotency keys, the recipe behind /dev/examples/idempotency (docs/guides/
 * routing-data.md, "Idempotency keys"). The client makes one key per intended
 * action (opening the form, not each click); the server runs the action once
 * per key and answers repeats, a double submit or a retry after a lost
 * response, with the first result instead of creating a second row or email.
 *
 * This store is in memory (one dev server process). A real app keeps keys in
 * Postgres, as the guide shows, so every instance sees them.
 */
type Entry = { scope: string; fingerprint: string; result: Promise<unknown>; expiresAt: number };

export type IdempotentResult<T> = { result: T; replayed: boolean };

export function createIdempotencyStore(options: { ttlMs?: number; now?: () => number } = {}) {
	const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
	const now = options.now ?? Date.now;
	const entries = new Map<string, Entry>();

	return {
		/**
		 * Runs `action` once per `key`. `scope` (who and what, e.g. "user-1:send-invite")
		 * stops one user's key from replaying another's result; `fingerprint` (the
		 * input) refuses a key reused for different input with CONFLICT. A failed
		 * action forgets its key, so the retry runs it again.
		 */
		async run<T>(
			key: string,
			scope: string,
			fingerprint: string,
			action: () => Promise<T>,
		): Promise<IdempotentResult<T>> {
			for (const [stored, entry] of entries) if (entry.expiresAt <= now()) entries.delete(stored);
			const existing = entries.get(key);
			if (existing) {
				if (existing.scope !== scope || existing.fingerprint !== fingerprint) {
					throw new AppError("CONFLICT", "Idempotency key reused for a different request");
				}
				// A duplicate that arrives while the first is still running waits for the same result.
				return { result: (await existing.result) as T, replayed: true };
			}
			const result = action();
			entries.set(key, { scope, fingerprint, result, expiresAt: now() + ttlMs });
			try {
				return { result: await result, replayed: false };
			} catch (error) {
				entries.delete(key);
				throw error;
			}
		},
		clear: () => entries.clear(),
	};
}

// ---------------------------------------------------------------------------
// The example: "send a message", slow enough to double-click
// ---------------------------------------------------------------------------

export type ExampleMessage = { id: number; text: string; sentAt: string };

const messages: ExampleMessage[] = [];
const keys = createIdempotencyStore();
let nextId = 1;

export const listMessages = (): ExampleMessage[] => [...messages];

export const resetMessages = () => {
	messages.length = 0;
	keys.clear();
	nextId = 1;
};

const send = async (text: string): Promise<ExampleMessage> => {
	await new Promise((resolve) => setTimeout(resolve, 400));
	const message = { id: nextId++, text, sentAt: new Date().toISOString() };
	messages.push(message);
	return message;
};

/** With a key, repeats return the first message; without one, every call sends again. */
export const sendMessage = async (input: { text: string; key?: string | undefined }) =>
	input.key
		? keys.run(input.key, "example:send-message", input.text, () => send(input.text))
		: { result: await send(input.text), replayed: false };
