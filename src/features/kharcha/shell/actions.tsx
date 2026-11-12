import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { sessionQueryOptions } from "@/features/auth/queries";

/** What the + menu can start (PLAN 14.5 "UX"): each task adds its own (Add expense in 89, Settle up in 91). */
export const CREATE_ACTIONS = ["friend", "group"] as const;
export type CreateAction = (typeof CREATE_ACTIONS)[number];

export type KharchaActions = {
	openPalette: () => void;
	openShortcuts: () => void;
	create: (action: CreateAction) => void;
};

const noop = () => undefined;

/** The shell's dialogs, for any page's buttons (a page outside the shell, a story, gets no-ops). */
export const KharchaActionsContext = createContext<KharchaActions>({
	openPalette: noop,
	openShortcuts: noop,
	create: noop,
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
