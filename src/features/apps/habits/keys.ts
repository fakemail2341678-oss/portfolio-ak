/**
 * Habits' reads and the habit writes (decision 0193). Keys carry the user's id, so
 * another account signing in on the same tab never sees cached habits. Check-ins are
 * a TanStack DB collection over the overview query (./collection.ts); habits
 * themselves are Query mutations that refresh the user's keys.
 */
export const habitsKeys = {
	all: ["apps", "habits"] as const,
	user: (userId: string) => [...habitsKeys.all, userId] as const,
	overview: (userId: string) => [...habitsKeys.user(userId), "overview"] as const,
	habit: (userId: string, id: string) => [...habitsKeys.user(userId), "habit", id] as const,
};
