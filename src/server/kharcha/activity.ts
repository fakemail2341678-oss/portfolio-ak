import "@tanstack/react-start/server-only";
import type { ActivityData, ActivityKind, ActivityValue } from "@/features/kharcha/types";
import { khActivity } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";

/**
 * Kharcha's history (docs/guides/kharcha.md "Activity"): every write leaves its rows here,
 * in its own transaction. They are the system lines of a thread ("Asha changed the amount
 * from … to …") and an expense's own history, not the admin audit log.
 */

export type ActivityEntry = {
	kind: ActivityKind;
	expenseId?: string | null;
	paymentId?: string | null;
	/** The person it was done to (a member added, a friend made). */
	subjectId?: string | null;
	data?: ActivityData;
};

/** Where the lines show: a group's thread, the thread of two people, or only on their expense or payment. */
export type ActivityScope = { groupId: string | null; pair: readonly [string, string] | null };

/**
 * The thread an expense or payment outside a group belongs to: the two people on it. With
 * one person (a personal expense) or more than two there is none; a thread then finds it
 * through the expense itself (Task 90).
 */
export const pairOf = (people: Iterable<string>): readonly [string, string] | null => {
	const [first, second, ...rest] = [...new Set(people)];
	if (!first || !second || rest.length > 0) return null;
	return first < second ? [first, second] : [second, first];
};

export async function recordActivity(
	tx: Tx,
	actorId: string | null,
	scope: ActivityScope,
	...entries: ActivityEntry[]
): Promise<void> {
	if (entries.length === 0) return;
	await tx.insert(khActivity).values(
		entries.map((entry) => ({
			groupId: scope.groupId,
			personLo: scope.groupId ? null : (scope.pair?.[0] ?? null),
			personHi: scope.groupId ? null : (scope.pair?.[1] ?? null),
			expenseId: entry.expenseId ?? null,
			paymentId: entry.paymentId ?? null,
			actorId,
			subjectId: entry.subjectId ?? null,
			kind: entry.kind,
			data: entry.data ?? {},
		})),
	);
}

/**
 * One entry per field of `after` that differs from `before`: `{ field, from, to }`. The
 * fields are scalars (a title, an amount, a date).
 */
export function fieldChanges(
	kind: ActivityKind,
	before: Readonly<Record<string, ActivityValue | undefined>>,
	after: Readonly<Record<string, ActivityValue | undefined>>,
): Array<{ kind: ActivityKind; data: ActivityData }> {
	return Object.entries(after).flatMap(([field, to]) =>
		to === undefined || (before[field] ?? null) === to
			? []
			: [{ kind, data: { field, from: before[field] ?? null, to } }],
	);
}
