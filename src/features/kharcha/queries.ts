import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import { addKharchaFriend } from "@/functions/kharcha/friends";
import { createKharchaGroup } from "@/functions/kharcha/groups";
import { completeKharchaOnboarding, getKharchaHome, getKharchaMe, getKharchaRev } from "@/functions/kharcha/me";
import type { AddFriendInput, CreateGroupInput, OnboardingInput } from "./schema";

/**
 * Kharcha's queries (TanStack Query only, PLAN 14.5 "Client state"). Every key starts with
 * the caller's id, so a change of session never shows another's data, and `kharchaKeys.user`
 * is what a moved `rev` refetches.
 */
export const kharchaKeys = {
	all: ["kharcha"] as const,
	user: (userId: string) => [...kharchaKeys.all, userId] as const,
	me: (userId: string) => [...kharchaKeys.user(userId), "me"] as const,
	home: (userId: string) => [...kharchaKeys.user(userId), "home"] as const,
	/** Outside `user`: polling it mustn't refetch itself. */
	rev: (userId: string) => [...kharchaKeys.all, "rev", userId] as const,
};

export const kharchaMeQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.me(userId), queryFn: () => getKharchaMe() });

export const kharchaHomeQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.home(userId), queryFn: () => getKharchaHome() });

/** Every 15 s while the page is visible, and on focus (PLAN 14.5 "Freshness"); the shell compares it. */
export const kharchaRevQueryOptions = (userId: string) =>
	queryOptions({
		queryKey: kharchaKeys.rev(userId),
		queryFn: () => getKharchaRev(),
		refetchInterval: 15_000,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: "always",
		staleTime: 0,
	});

/** Everything the caller's pages read: after one of their own changes, or a moved `rev`. */
export const refreshKharcha = (queryClient: QueryClient, userId: string) =>
	queryClient.invalidateQueries({ queryKey: kharchaKeys.user(userId) });

export const kharchaMutations = {
	onboard: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: OnboardingInput) => completeKharchaOnboarding({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	addFriend: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: AddFriendInput) => addKharchaFriend({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	createGroup: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: CreateGroupInput) => createKharchaGroup({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
};
