import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import {
	createKharchaExpense,
	deleteKharchaExpense,
	getKharchaExpense,
	getKharchaMerchants,
	listKharchaSpend,
	markKharchaDuplicate,
	restoreKharchaExpense,
	updateKharchaExpense,
} from "@/functions/kharcha/expenses";
import { addKharchaFriend } from "@/functions/kharcha/friends";
import { createKharchaGroup } from "@/functions/kharcha/groups";
import { getKharchaLists } from "@/functions/kharcha/lists";
import { completeKharchaOnboarding, getKharchaHome, getKharchaMe, getKharchaRev } from "@/functions/kharcha/me";
import { createKharchaDraft, deleteKharchaDraft, getKharchaUploadSettings } from "@/functions/kharcha/receipts";
import type {
	AddFriendInput,
	CreateExpenseInput,
	CreateGroupInput,
	OnboardingInput,
	UpdateExpenseInput,
} from "./schema";
import type { SpendListInput } from "./search";

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
	spend: (userId: string, input: SpendListInput) => [...kharchaKeys.user(userId), "spend", input] as const,
	expense: (userId: string, expenseId: string) => [...kharchaKeys.user(userId), "expense", expenseId] as const,
	lists: (userId: string) => [...kharchaKeys.user(userId), "lists"] as const,
	merchants: (userId: string) => [...kharchaKeys.user(userId), "merchants"] as const,
	/** Outside `user`: polling it mustn't refetch itself. */
	rev: (userId: string) => [...kharchaKeys.all, "rev", userId] as const,
};

export const kharchaMeQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.me(userId), queryFn: () => getKharchaMe() });

export const kharchaHomeQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.home(userId), queryFn: () => getKharchaHome() });

export const kharchaSpendQueryOptions = (userId: string, input: SpendListInput) =>
	queryOptions({ queryKey: kharchaKeys.spend(userId, input), queryFn: () => listKharchaSpend({ data: input }) });

export const kharchaExpenseQueryOptions = (userId: string, expenseId: string) =>
	queryOptions({
		queryKey: kharchaKeys.expense(userId, expenseId),
		queryFn: () => getKharchaExpense({ data: { expenseId } }),
	});

export const kharchaListsQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.lists(userId), queryFn: () => getKharchaLists() });

export const kharchaMerchantsQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.merchants(userId), queryFn: () => getKharchaMerchants() });

/** Whether receipts can be uploaded here (Cloudinary is configured). */
export const kharchaUploadsQueryOptions = () =>
	queryOptions({
		queryKey: [...kharchaKeys.all, "uploads"],
		queryFn: () => getKharchaUploadSettings(),
		staleTime: Number.POSITIVE_INFINITY,
	});

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
	createExpense: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: CreateExpenseInput) => createKharchaExpense({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	updateExpense: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: UpdateExpenseInput) => updateKharchaExpense({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	trashExpense: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: ({ expenseId, restore }: { expenseId: string; restore: boolean }) =>
				restore ? restoreKharchaExpense({ data: { expenseId } }) : deleteKharchaExpense({ data: { expenseId } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	markDuplicate: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: { expenseId: string; ok: boolean }) => markKharchaDuplicate({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	createDraft: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (receiptIds: string[]) => createKharchaDraft({ data: { receiptIds } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	deleteDraft: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (id: string) => deleteKharchaDraft({ data: { id } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
};
