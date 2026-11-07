import { DbProvider } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { dbClientFor } from "@/lib/tanstack-db";

/**
 * TanStack DB for the pages below it (decision 0189): the showcase apps' layout and
 * the optimistic-update example mount it. It provides the request's DbClient (one per
 * QueryClient) and, on the server, cleans it up when the page has rendered. Because
 * only these pages import it, DB's runtime is in their chunks, not in every page's.
 */
export function DbScope({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const client = dbClientFor(
		queryClient,
		router.isServer ? (listener) => router.serverSsr?.onRenderFinished(listener) : undefined,
	);
	return <DbProvider client={client}>{children}</DbProvider>;
}
