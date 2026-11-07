import { fn } from "storybook/test";
import type { AdminSettings } from "../../../../src/features/parda/admin/schema";

// Stand-ins for src/functions/parda-admin/settings.ts.
export const PARDA_STORY_SETTINGS: AdminSettings = {
	region: "US",
	languages: ["en", "ne"],
	kidsCap: "PG",
	banner: { en: "", ne: "" },
	playbackEnabled: true,
	cacheEpoch: 0,
	sourceOrder: "auto",
	updatedAt: "1",
};

export const getPardaSettings = fn(async (): Promise<AdminSettings> => PARDA_STORY_SETTINGS).mockName(
	"getPardaSettings",
);
export const updatePardaSettings = fn(async (): Promise<AdminSettings> => PARDA_STORY_SETTINGS).mockName(
	"updatePardaSettings",
);
export const setPardaPlayback = fn(async (): Promise<AdminSettings> => PARDA_STORY_SETTINGS).mockName(
	"setPardaPlayback",
);
export const setPardaSourceOrder = fn(async (): Promise<AdminSettings> => PARDA_STORY_SETTINGS).mockName(
	"setPardaSourceOrder",
);
export const purgePardaCache = fn(async (): Promise<AdminSettings> => PARDA_STORY_SETTINGS).mockName("purgePardaCache");
