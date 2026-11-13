import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { kharchaMutations } from "../queries";
import type { ThreadTalk } from "../types";

/**
 * Marks a thread read while it is on screen (Task 92): once the page shows lines from
 * others the caller hadn't read, its read mark moves to now and its notifications clear.
 * A write after the first paint, never part of it; preloading a link reads nothing.
 */
export function useMarkRead(userId: string, talk: Pick<ThreadTalk, "thread" | "unread">): void {
	const queryClient = useQueryClient();
	const { mutate } = useMutation(kharchaMutations.readThread(queryClient, userId));
	useEffect(() => {
		if (talk.unread > 0) mutate(talk.thread);
	}, [talk.thread, talk.unread, mutate]);
}
