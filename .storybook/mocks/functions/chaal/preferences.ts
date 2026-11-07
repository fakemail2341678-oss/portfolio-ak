import { fn } from "storybook/test";
import { type ChaalPreferences, DEFAULT_CHAAL_PREFERENCES } from "../../../../src/features/chaal/settings/preferences";

// Stand-ins for src/functions/chaal/preferences.ts.
export const getChaalPreferences = fn(async (): Promise<ChaalPreferences | null> => null).mockName(
	"getChaalPreferences",
);
export const saveChaalPreferences = fn(
	async ({ data }: { data: { preferences: ChaalPreferences } }): Promise<ChaalPreferences> => data.preferences,
).mockName("saveChaalPreferences");
export const importChaalPreferences = fn(
	async ({ data }: { data: { preferences: ChaalPreferences } }): Promise<ChaalPreferences> =>
		data.preferences ?? DEFAULT_CHAAL_PREFERENCES,
).mockName("importChaalPreferences");
