import { ADAPTERS } from "../player/adapters";
import type { WatchSource } from "../player/watch-types";

/** A party's source and what it allows (PLAN 12.5, "Watch party"). Isomorphic. */

export type PartyMode = "full" | "together";

/** At most this many people in a party. */
export const PARTY_MAX_MEMBERS = 10;

/** Commands mean full sync; without them everyone starts together and runs on their own. */
export const partyMode = (source: Pick<WatchSource, "adapter"> | null): PartyMode =>
	source && ADAPTERS[source.adapter].command ? "full" : "together";

/** The highest-ranked source that obeys commands, else the top source. */
export function partySource<T extends Pick<WatchSource, "id" | "adapter">>(
	sources: ReadonlyArray<T>,
	order: ReadonlyArray<string>,
): T | null {
	const ranked = order.flatMap((id) => sources.filter((source) => source.id === id));
	return ranked.find((source) => partyMode(source) === "full") ?? ranked[0] ?? null;
}

/** Whether a reload can land on the group's position: its adapter takes `{start}`, or its template asks for it. */
export const takesStart = (source: Pick<WatchSource, "adapter" | "url">) =>
	ADAPTERS[source.adapter].startPosition === "param" || source.url.includes("{start}");
