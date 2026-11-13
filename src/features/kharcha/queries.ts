import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import { listKharchaBudgets } from "@/functions/kharcha/budgets";
import {
	createKharchaComment,
	deleteKharchaComment,
	markKharchaNotificationsRead,
	markKharchaThreadRead,
	reactKharchaComment,
	setKharchaFocus,
	updateKharchaComment,
	updateKharchaNotifySettings,
} from "@/functions/kharcha/conversations";
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
import {
	addKharchaFriend,
	listKharchaFriends,
	setKharchaFriendEmail,
	updateKharchaFriend,
} from "@/functions/kharcha/friends";
import {
	addKharchaGroupMember,
	addKharchaNewGroupMember,
	archiveKharchaGroup,
	createKharchaGroup,
	getKharchaGroup,
	getKharchaGroupTotals,
	leaveKharchaGroup,
	listKharchaGroups,
	removeKharchaGroupMember,
	updateKharchaGroup,
} from "@/functions/kharcha/groups";
import {
	getKharchaInsightsOverview,
	getKharchaInsightsTrends,
	getKharchaStatement,
} from "@/functions/kharcha/insights";
import { acceptKharchaInvite, inviteKharchaFriend } from "@/functions/kharcha/invites";
import { getKharchaInvite } from "@/functions/kharcha/join";
import { getKharchaLists } from "@/functions/kharcha/lists";
import {
	completeKharchaOnboarding,
	getKharchaHome,
	getKharchaMe,
	getKharchaRev,
	updateKharchaProfile,
} from "@/functions/kharcha/me";
import {
	createKharchaPayment,
	deleteKharchaPayment,
	getKharchaPayment,
	restoreKharchaPayment,
	updateKharchaPayment,
} from "@/functions/kharcha/payments";
import { createKharchaDraft, deleteKharchaDraft, getKharchaUploadSettings } from "@/functions/kharcha/receipts";
import { listKharchaRecurring } from "@/functions/kharcha/recurring";
import { getKharchaSettleUp, remindKharchaFriend } from "@/functions/kharcha/settle";
import {
	bulkKharchaExpenses,
	deleteKharchaSearch,
	exportKharchaSpend,
	getKharchaSpendChart,
	importKharchaSpend,
	renameKharchaSearch,
	reorderKharchaSearches,
	saveKharchaSearch,
} from "@/functions/kharcha/spend";
import { getKharchaFriendThread, getKharchaGroupThread, listKharchaPeople } from "@/functions/kharcha/threads";
import type {
	AddFriendInput,
	BulkInput,
	CreateCommentInput,
	CreateExpenseInput,
	CreateGroupInput,
	CreatePaymentInput,
	FriendEmailInput,
	ImportInput,
	InviteInput,
	NewGroupMemberInput,
	NotifySettingsInput,
	OnboardingInput,
	PeopleInput,
	ProfileInput,
	ReactInput,
	SettleUpInput,
	SpendExportInput,
	UpdateCommentInput,
	UpdateExpenseInput,
	UpdateFriendInput,
	UpdateGroupInput,
	UpdatePaymentInput,
} from "./schema";
import type { InsightsInput, SpendChartInput, SpendListInput, StatementInput } from "./search";
import type { BudgetView, KharchaMe, RecurringView, SavedSearch } from "./types";

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
	spendChart: (userId: string, input: SpendChartInput) => [...kharchaKeys.user(userId), "spend-chart", input] as const,
	expense: (userId: string, expenseId: string) => [...kharchaKeys.user(userId), "expense", expenseId] as const,
	lists: (userId: string) => [...kharchaKeys.user(userId), "lists"] as const,
	merchants: (userId: string) => [...kharchaKeys.user(userId), "merchants"] as const,
	people: (userId: string, input: PeopleInput) => [...kharchaKeys.user(userId), "people", input] as const,
	friends: (userId: string) => [...kharchaKeys.user(userId), "friends"] as const,
	groups: (userId: string) => [...kharchaKeys.user(userId), "groups"] as const,
	groupThread: (userId: string, groupId: string) => [...kharchaKeys.user(userId), "group", groupId] as const,
	friendThread: (userId: string, personId: string) => [...kharchaKeys.user(userId), "friend", personId] as const,
	groupTotals: (userId: string, groupId: string) => [...kharchaKeys.user(userId), "group-totals", groupId] as const,
	settleUp: (userId: string, input: SettleUpInput) => [...kharchaKeys.user(userId), "settle-up", input] as const,
	payment: (userId: string, paymentId: string) => [...kharchaKeys.user(userId), "payment", paymentId] as const,
	/** Task 94: budgets, recurring expenses and insights. */
	budgets: (userId: string) => [...kharchaKeys.user(userId), "budgets"] as const,
	recurring: (userId: string) => [...kharchaKeys.user(userId), "recurring"] as const,
	insights: (userId: string, tab: "overview" | "trends" | "statement", input: InsightsInput | StatementInput) =>
		[...kharchaKeys.user(userId), "insights", tab, input] as const,
	/** Outside `user`: a visitor without a session reads it too. */
	join: (token: string) => [...kharchaKeys.all, "join", token] as const,
	/** Outside `user`: polling it mustn't refetch itself. */
	rev: (userId: string) => [...kharchaKeys.all, "rev", userId] as const,
};

export const kharchaMeQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.me(userId), queryFn: () => getKharchaMe() });

export const kharchaHomeQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.home(userId), queryFn: () => getKharchaHome() });

export const kharchaSpendQueryOptions = (userId: string, input: SpendListInput) =>
	queryOptions({ queryKey: kharchaKeys.spend(userId, input), queryFn: () => listKharchaSpend({ data: input }) });

/** Spend's chart (Task 93): the search summed by what it groups by, per currency. */
export const kharchaSpendChartQueryOptions = (userId: string, input: SpendChartInput) =>
	queryOptions({
		queryKey: kharchaKeys.spendChart(userId, input),
		queryFn: () => getKharchaSpendChart({ data: input }),
	});

/** The search, or the rows chosen, as CSV lines (Task 93): the page makes the file. */
export const exportKharcha = (data: SpendExportInput) => exportKharchaSpend({ data });

export const kharchaExpenseQueryOptions = (userId: string, expenseId: string) =>
	queryOptions({
		queryKey: kharchaKeys.expense(userId, expenseId),
		queryFn: () => getKharchaExpense({ data: { expenseId } }),
	});

export const kharchaListsQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.lists(userId), queryFn: () => getKharchaLists() });

export const kharchaMerchantsQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.merchants(userId), queryFn: () => getKharchaMerchants() });

/** `/people` (Task 90): the caller's friends and groups matching the search. */
export const kharchaPeopleQueryOptions = (userId: string, input: PeopleInput) =>
	queryOptions({ queryKey: kharchaKeys.people(userId, input), queryFn: () => listKharchaPeople({ data: input }) });

/** Who the caller can split with: the expense dialog's "Split with". */
export const kharchaFriendsQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.friends(userId), queryFn: () => listKharchaFriends() });

export const kharchaGroupsQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.groups(userId), queryFn: () => listKharchaGroups() });

/** One group with its members (the expense dialog's "Split with" a group). */
export const kharchaGroupQueryOptions = (userId: string, groupId: string) =>
	queryOptions({
		queryKey: [...kharchaKeys.user(userId), "group-view", groupId],
		queryFn: () => getKharchaGroup({ data: { groupId } }),
	});

export const kharchaGroupThreadQueryOptions = (userId: string, groupId: string) =>
	queryOptions({
		queryKey: kharchaKeys.groupThread(userId, groupId),
		queryFn: () => getKharchaGroupThread({ data: { groupId } }),
	});

export const kharchaFriendThreadQueryOptions = (userId: string, personId: string) =>
	queryOptions({
		queryKey: kharchaKeys.friendThread(userId, personId),
		queryFn: () => getKharchaFriendThread({ data: { personId } }),
	});

/** A group's Totals tab (Task 91). */
export const kharchaGroupTotalsQueryOptions = (userId: string, groupId: string) =>
	queryOptions({
		queryKey: kharchaKeys.groupTotals(userId, groupId),
		queryFn: () => getKharchaGroupTotals({ data: { groupId } }),
	});

/** The settle-up dialog's choices (Task 91): in a group, with a friend, or every open balance. */
export const kharchaSettleUpQueryOptions = (userId: string, input: SettleUpInput) =>
	queryOptions({ queryKey: kharchaKeys.settleUp(userId, input), queryFn: () => getKharchaSettleUp({ data: input }) });

/** One payment, to edit (a card's "Edit"). */
export const kharchaPaymentQueryOptions = (userId: string, paymentId: string) =>
	queryOptions({
		queryKey: kharchaKeys.payment(userId, paymentId),
		queryFn: () => getKharchaPayment({ data: { paymentId } }),
	});

/** An invite link's public lookup (`/join/$token`). */
export const kharchaJoinQueryOptions = (token: string) =>
	queryOptions({ queryKey: kharchaKeys.join(token), queryFn: () => getKharchaInvite({ data: { token } }) });

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

/** A saved search's change answers with all of them: the caller's `me` (the rail's list) takes it. */
const searchesChanged = (queryClient: QueryClient, userId: string) => (searches: SavedSearch[]) => {
	queryClient.setQueryData<KharchaMe>(kharchaKeys.me(userId), (me) => (me ? { ...me, searches } : me));
};

/** Insights' budgets and Home's progress (Task 94). */
export const kharchaBudgetsQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.budgets(userId), queryFn: () => listKharchaBudgets() });

/** Settings → Recurring (Task 94). */
export const kharchaRecurringQueryOptions = (userId: string) =>
	queryOptions({ queryKey: kharchaKeys.recurring(userId), queryFn: () => listKharchaRecurring() });

export const kharchaOverviewQueryOptions = (userId: string, input: InsightsInput) =>
	queryOptions({
		queryKey: kharchaKeys.insights(userId, "overview", input),
		queryFn: () => getKharchaInsightsOverview({ data: input }),
	});

export const kharchaTrendsQueryOptions = (userId: string, input: InsightsInput) =>
	queryOptions({
		queryKey: kharchaKeys.insights(userId, "trends", input),
		queryFn: () => getKharchaInsightsTrends({ data: input }),
	});

export const kharchaStatementQueryOptions = (userId: string, input: StatementInput) =>
	queryOptions({
		queryKey: kharchaKeys.insights(userId, "statement", input),
		queryFn: () => getKharchaStatement({ data: input }),
	});

export const kharchaMutations = {
	/** A change to the caller's budgets (Task 94): the answer is all of them; Home and Insights refetch. */
	budgets: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (run: () => Promise<BudgetView[]>) => run(),
			onSuccess: (budgets) => {
				queryClient.setQueryData(kharchaKeys.budgets(userId), budgets);
				void refreshKharcha(queryClient, userId);
			},
		}),
	/** A change to the caller's recurring expenses (Task 94), the same way. */
	recurring: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (run: () => Promise<RecurringView[]>) => run(),
			onSuccess: (recurring) => {
				queryClient.setQueryData(kharchaKeys.recurring(userId), recurring);
				void refreshKharcha(queryClient, userId);
			},
		}),
	bulk: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: BulkInput) => bulkKharchaExpenses({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	saveSearch: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: { name: string; query: string }) => saveKharchaSearch({ data }),
			onSuccess: searchesChanged(queryClient, userId),
		}),
	renameSearch: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: { id: string; name: string }) => renameKharchaSearch({ data }),
			onSuccess: searchesChanged(queryClient, userId),
		}),
	reorderSearches: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (ids: string[]) => reorderKharchaSearches({ data: { ids } }),
			onSuccess: searchesChanged(queryClient, userId),
		}),
	deleteSearch: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (id: string) => deleteKharchaSearch({ data: { id } }),
			onSuccess: searchesChanged(queryClient, userId),
		}),
	importSpend: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: ImportInput) => importKharchaSpend({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
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
	updateFriend: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: UpdateFriendInput) => updateKharchaFriend({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	setFriendEmail: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: FriendEmailInput) => setKharchaFriendEmail({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	invite: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: InviteInput) => inviteKharchaFriend({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	acceptInvite: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (token: string) => acceptKharchaInvite({ data: { token } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	updateGroup: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: UpdateGroupInput) => updateKharchaGroup({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	archiveGroup: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: { groupId: string; archived: boolean }) => archiveKharchaGroup({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	addMember: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: { groupId: string; personId: string }) => addKharchaGroupMember({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	addNewMember: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: NewGroupMemberInput) => addKharchaNewGroupMember({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	removeMember: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: { groupId: string; personId: string }) => removeKharchaGroupMember({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	createPayment: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: CreatePaymentInput) => createKharchaPayment({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	updatePayment: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: UpdatePaymentInput) => updateKharchaPayment({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	trashPayment: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: ({ paymentId, restore }: { paymentId: string; restore: boolean }) =>
				restore ? restoreKharchaPayment({ data: { paymentId } }) : deleteKharchaPayment({ data: { paymentId } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	remind: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (personId: string) => remindKharchaFriend({ data: { personId } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	updateProfile: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: ProfileInput) => updateKharchaProfile({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	comment: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: CreateCommentInput) => createKharchaComment({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	editComment: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: UpdateCommentInput) => updateKharchaComment({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	deleteComment: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (commentId: string) => deleteKharchaComment({ data: { commentId } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	react: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: ReactInput) => reactKharchaComment({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	/** Reading a thread clears its badge on People and its notifications: those two refetch, nothing else. */
	readThread: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (thread: string) => markKharchaThreadRead({ data: { thread } }),
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: [...kharchaKeys.user(userId), "people"] }),
					queryClient.invalidateQueries({ queryKey: kharchaKeys.home(userId) }),
					queryClient.invalidateQueries({ queryKey: kharchaKeys.rev(userId) }),
				]),
		}),
	readNotifications: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (ids?: string[]) => markKharchaNotificationsRead({ data: ids ? { ids } : {} }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	notifySettings: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (data: NotifySettingsInput) => updateKharchaNotifySettings({ data }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	focus: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (focus: boolean) => setKharchaFocus({ data: { focus } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
	leaveGroup: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (groupId: string) => leaveKharchaGroup({ data: { groupId } }),
			onSuccess: () => refreshKharcha(queryClient, userId),
		}),
};
