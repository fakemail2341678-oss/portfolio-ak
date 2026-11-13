import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { sessionQueryOptions } from "@/features/auth/queries";
import type { ExpenseView, ReceiptDraftView, SettleChoice } from "../types";

/** What the + menu can start (PLAN 14.5 "UX"): each task adds its own (Settle up in 91). */
export const CREATE_ACTIONS = ["expense", "split", "settle", "receipt", "friend", "group"] as const;
export type CreateAction = (typeof CREATE_ACTIONS)[number];

/**
 * What the expense dialog opens with: an expense to edit, a receipt draft to fill in, files
 * dropped on the page; a group, or friends, to split it with (Task 90), or  to open
 * the split with nobody chosen yet ("Split a bill").
 */
export type ExpenseStart = {
	expense?: ExpenseView;
	draft?: ReceiptDraftView;
	files?: ReadonlyArray<File>;
	groupId?: string;
	with?: ReadonlyArray<string>;
	split?: boolean;
};

/**
 * What the settle-up dialog opens with (Task 91): a group's or a friend's open debts, one
 * of them already picked, or (none of these) every open balance of the caller's; or a
 * payment to edit.
 */
export type SettleStart = { groupId?: string; personId?: string; choice?: SettleChoice; paymentId?: string };

export type KharchaActions = {
	openPalette: () => void;
	openShortcuts: () => void;
	create: (action: CreateAction) => void;
	/** The expense dialog: a new expense (from a draft or dropped files), or one to edit. */
	addExpense: (start?: ExpenseStart) => void;
	editExpense: (expense: ExpenseView) => void;
	/** The settle-up dialog (Task 91): record a payment, or edit one (`paymentId`). */
	settleUp: (start?: SettleStart) => void;
};

const noop = () => undefined;

/** The shell's dialogs, for any page's buttons (a page outside the shell, a story, gets no-ops). */
export const KharchaActionsContext = createContext<KharchaActions>({
	openPalette: noop,
	openShortcuts: noop,
	create: noop,
	addExpense: noop,
	editExpense: noop,
	settleUp: noop,
});

export const useKharchaActions = () => useContext(KharchaActionsContext);

/** Set inside the shell: a 404 rendered within it doesn't draw a second one. */
export const InKharchaShell = createContext(false);

/**
 * The signed-in caller's id, kept after the session goes: signing out clears the session
 * before the page is left, and a query keyed by an empty id would fetch without one (a
 * 401, which sends the browser to /login).
 */
export function useKharchaUserId(): string {
	const { data: session } = useQuery(sessionQueryOptions());
	const current = session?.user.id ?? "";
	const [userId, setUserId] = useState(current);
	if (current && current !== userId) setUserId(current);
	return current || userId;
}
