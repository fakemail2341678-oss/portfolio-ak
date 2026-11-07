import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { collectionOptions } from "@tanstack/react-db";
import { getHabitsOverview, setHabitCheckin } from "@/functions/apps/habits";
import { queryClientOf } from "@/lib/tanstack-db";
import { habitsKeys } from "./queries";
import type { HabitCheckin, HabitsOverview } from "./types";

/**
 * The strip's check-ins as a TanStack DB collection (decisions 0189, 0193), over the
 * overview query the page's loader filled, so the first rows are the server-rendered
 * ones. A tap shows at once; the handler saves the day's count, and if the server
 * refuses, DB puts the cell back. After a save the overview is read again, which
 * brings the habit's new streak and rate.
 */

/** After a save, the overview is read again before the optimistic change is dropped (no flicker). */
const saved = async (collection: { utils: { refetch: () => Promise<unknown> } }) => {
	await collection.utils.refetch();
	return { refetch: false };
};

const make = (userId: string) =>
	collectionOptions(`habits:checkins:${userId}`, (client) =>
		queryCollectionOptions({
			id: `habits:checkins:${userId}`,
			queryKey: habitsKeys.overview(userId),
			queryFn: () => getHabitsOverview(),
			select: (overview: HabitsOverview) => overview.checkins,
			queryClient: queryClientOf(client),
			getKey: (checkin: HabitCheckin) => checkin.id,
			onInsert: async ({ transaction, collection }) => {
				for (const { modified } of transaction.mutations) {
					await setHabitCheckin({ data: { habitId: modified.habitId, day: modified.day, count: modified.count } });
				}
				return saved(collection);
			},
			onUpdate: async ({ transaction, collection }) => {
				for (const { modified } of transaction.mutations) {
					await setHabitCheckin({ data: { habitId: modified.habitId, day: modified.day, count: modified.count } });
				}
				return saved(collection);
			},
			onDelete: async ({ transaction, collection }) => {
				for (const { original } of transaction.mutations) {
					await setHabitCheckin({ data: { habitId: original.habitId, day: original.day, count: 0 } });
				}
				return saved(collection);
			},
		}),
	);

const made = new Map<string, ReturnType<typeof make>>();

/** The collection descriptor of one user's check-ins (the same object every time, as DB needs). */
export function checkinsCollection(userId: string): ReturnType<typeof make> {
	let found = made.get(userId);
	if (!found) {
		found = make(userId);
		made.set(userId, found);
	}
	return found;
}
