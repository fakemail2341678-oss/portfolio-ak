import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import { createHabit, deleteHabit, getHabit, getHabitsOverview, updateHabit } from "@/functions/apps/habits";
import type { CreateHabitInput, UpdateHabitInput } from "./schema";

/**
 * Habits' reads and the habit writes (decision 0193). Keys carry the user's id, so
 * another account signing in on the same tab never sees cached habits. Check-ins are
 * a TanStack DB collection over the overview query (./collections.ts); habits
 * themselves are Query mutations that refresh the user's keys.
 */
export const habitsKeys = {
	all: ["apps", "habits"] as const,
	user: (userId: string) => [...habitsKeys.all, userId] as const,
	overview: (userId: string) => [...habitsKeys.user(userId), "overview"] as const,
	habit: (userId: string, id: string) => [...habitsKeys.user(userId), "habit", id] as const,
};

export const habitsOverviewQueryOptions = (userId: string) =>
	queryOptions({ queryKey: habitsKeys.overview(userId), queryFn: () => getHabitsOverview() });

export const habitQueryOptions = (userId: string, id: string) =>
	queryOptions({ queryKey: habitsKeys.habit(userId, id), queryFn: () => getHabit({ data: { id } }) });

const refresh = (queryClient: QueryClient, userId: string) =>
	queryClient.invalidateQueries({ queryKey: habitsKeys.user(userId) });

export const habitMutations = {
	create: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: CreateHabitInput) => createHabit({ data: input }),
			onSettled: () => refresh(queryClient, userId),
		}),
	update: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: UpdateHabitInput) => updateHabit({ data: input }),
			onSettled: () => refresh(queryClient, userId),
		}),
	/** Refreshes the overview only: the habit's own page, still on screen, would refetch a 404. */
	delete: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (id: string) => deleteHabit({ data: { id } }),
			onSettled: () => queryClient.invalidateQueries({ queryKey: habitsKeys.overview(userId) }),
		}),
};
