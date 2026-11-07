import { fn } from "storybook/test";
import type { AnimeWeekData } from "../../../../src/features/parda/schedule/types";

// Stand-in for src/functions/parda/schedule.ts: the workshop has no catalogue.
export const getPardaAnimeWeek = fn(async (): Promise<AnimeWeekData> => ({ configured: false })).mockName(
	"getPardaAnimeWeek",
);
