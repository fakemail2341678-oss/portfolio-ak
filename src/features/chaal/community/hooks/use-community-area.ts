import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/features/auth/queries";
import { canConnect } from "../../connect/hooks/use-connect";
import type { ChaalFeature } from "../../lib/features";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../../queries";
import type { CommunityArea, LichessUse } from "../components/header";

/** Whether an area is on, from the status every page has. */
export function useAreaOn(area: CommunityArea): boolean {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	return status?.features[area] !== false;
}

/**
 * Whether the viewer may act on Lichess for an area now: connected with its scopes (`ok`),
 * not connected (`connect`, or `unavailable` when connecting is off), or connected without
 * the area's scopes or with a refused token (`reconnect`).
 */
export function useLichessFor(feature: ChaalFeature): LichessUse {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: session } = useQuery(sessionQueryOptions());
	// Without a session there is no connection to ask about (the call would be refused).
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	if (connection && !connection.revoked && !connection.needsScopesFor.includes(feature)) return "ok";
	if (!canConnect(status)) return "unavailable";
	return connection ? "reconnect" : "connect";
}
