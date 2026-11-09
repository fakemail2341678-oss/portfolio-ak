import { fn } from "storybook/test";
import type { ChaalAdminSettings } from "../../../../src/features/chaal/admin/schema";
import { DEFAULT_ENGINE_LIMITS } from "../../../../src/features/chaal/engine/limits";
import { CHAAL_FEATURES, type ChaalFeature } from "../../../../src/features/chaal/features";
import { DEFAULT_PLAY_LIMITS } from "../../../../src/features/chaal/play/controls";
import { DEFAULT_CHAAL_DEFAULTS } from "../../../../src/features/chaal/settings/preferences";

// Stand-ins for src/functions/chaal-admin/settings.ts.
export const chaalAdminSettings: ChaalAdminSettings = {
	features: Object.fromEntries(CHAAL_FEATURES.map((feature) => [feature, feature !== "studies"])) as Record<
		ChaalFeature,
		boolean
	>,
	guestsMayConnect: true,
	extraScopes: [],
	play: DEFAULT_PLAY_LIMITS,
	defaults: DEFAULT_CHAAL_DEFAULTS,
	engine: DEFAULT_ENGINE_LIMITS,
	banner: { en: "Lichess is upgrading on Sunday: games may pause for a few minutes.", ne: "" },
	maintenance: false,
	maintenanceMessage: { en: "", ne: "" },
	cacheEpoch: 3,
	connectConfigured: true,
	updatedAt: "4",
};

export const getChaalAdminSettings = fn(async (): Promise<ChaalAdminSettings> => chaalAdminSettings).mockName(
	"getChaalAdminSettings",
);
export const updateChaalSettings = fn(async (): Promise<ChaalAdminSettings> => chaalAdminSettings).mockName(
	"updateChaalSettings",
);
export const setChaalMaintenance = fn(async (): Promise<ChaalAdminSettings> => chaalAdminSettings).mockName(
	"setChaalMaintenance",
);
export const purgeChaalCache = fn(async (): Promise<ChaalAdminSettings> => chaalAdminSettings).mockName(
	"purgeChaalCache",
);
