import { useMatches } from "@tanstack/react-router";

/**
 * Sections that never read the session (the portfolio) skip looking it up:
 *
 *   staticData: { session: "skip" }
 *
 * When any matched route sets it, the root `beforeLoad` puts `session: null` in
 * the context without a lookup, and the root-mounted session readers
 * (ImpersonationBanner, ObservabilitySync) don't fetch it after hydration either
 * (decision 0161). Server functions still check the session themselves.
 */
export type SessionScope = "skip";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		/** "skip": this section never reads the session, so nothing looks it up. */
		session?: SessionScope;
	}
}

/** True when a matched route skips the session. */
export const skipsSession = (matches: ReadonlyArray<{ staticData: { session?: SessionScope | undefined } }>): boolean =>
	matches.some((match) => match.staticData.session === "skip");

/** For components that read the session with useQuery: pass `enabled: !useSessionSkipped()`. */
export const useSessionSkipped = () => useMatches({ select: skipsSession });
