import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { authErrorMessage } from "@/features/auth/errors";
import { sessionQueryOptions } from "@/features/auth/queries";
import { setGuestScope } from "@/lib/guests";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import { CONNECT_RESULT_PARAM, connectHref } from "../links";
import type { ChaalConnection, ChaalStatus } from "../schema";

/**
 * Where a connection stands, for the account button's dot, the menu and the settings:
 * `ok`, `attention` (Lichess refused the token, or an enabled feature needs a scope it
 * lacks: "Reconnect"), or `none`.
 */
export type ConnectionState = "ok" | "attention" | "none";

export const connectionState = (connection: ChaalConnection | null | undefined): ConnectionState =>
	!connection ? "none" : connection.revoked || connection.needsScopesFor.length > 0 ? "attention" : "ok";

/** Whether this visitor may start connecting: the server's switch (a key is set, guests allowed). */
export const canConnect = (status: ChaalStatus | undefined) => status?.connect === "on";

/** The page to come back to, without an earlier `?lichess=` result. */
function returnPath(href: string): string {
	const url = new URL(href, "http://chaal.invalid");
	url.searchParams.delete(CONNECT_RESULT_PARAM);
	return localizeHref(`${url.pathname}${url.search}${url.hash}`);
}

/**
 * Connecting Lichess (decision 0256) from any Chaal page: it needs a session, so a visitor
 * gets a guest scoped to Chaal first (`guest_scope`, which seeds nothing), then the browser
 * goes through /api/chaal/oauth/start and comes back here with `?lichess=<result>`.
 */
export function useConnectLichess() {
	const { data: session } = useQuery(sessionQueryOptions());
	const href = useRouterState({ select: (state) => state.location.href });
	const [pending, setPending] = useState(false);
	const connect = async (returnTo: string = href) => {
		if (pending) return;
		setPending(true);
		if (!session) {
			const { authClient } = await import("@/lib/auth-client");
			setGuestScope("chaal");
			const { error } = await authClient.signIn.anonymous();
			if (error) {
				toast.error(error.status === 429 ? m.ch_guest_rate_limited() : authErrorMessage(error));
				setPending(false);
				return;
			}
		}
		// A full load: Lichess's page, then our callback, then back here.
		window.location.assign(connectHref(returnPath(returnTo)));
	};
	return { connect, pending };
}
