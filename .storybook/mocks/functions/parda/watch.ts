import { fn } from "storybook/test";
import type { PartyPageData } from "../../../../src/features/parda/party/types";
import type { WatchPageData } from "../../../../src/features/parda/player/watch-types";

// Stand-ins for src/functions/parda/watch.ts: the catalogue isn't configured in the workshop.
export const getPardaWatch = fn(async (): Promise<WatchPageData> => ({ configured: false })).mockName("getPardaWatch");
export const getPardaParty = fn(async (): Promise<PartyPageData> => ({ configured: false })).mockName("getPardaParty");
export const recordPardaPlay = fn(async () => ({ ok: true as const })).mockName("recordPardaPlay");
export const reportPardaProblem = fn(async () => ({ id: "" })).mockName("reportPardaProblem");
