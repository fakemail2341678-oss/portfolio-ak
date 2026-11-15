import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import { createHabit, deleteHabit, getHabit, getHabitsOverview, updateHabit } from "@/functions/apps/habits";
import { habitsKeys } from "./keys";
import type { CreateHabitInput, UpdateHabitInput } from "./schema";

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
