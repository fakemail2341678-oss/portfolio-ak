import { fn } from "storybook/test";
import {
	type ChaalPreferences,
	DEFAULT_CHAAL_PREFERENCES,
} from "../../../../src/features/chaal/settings/lib/preferences";

// Stand-ins for src/functions/chaal/preferences.ts.
export const getChaalPreferences = fn(async (): Promise<ChaalPreferences | null> => null).mockName(
	"getChaalPreferences",
);
export const setChaalPreferences = fn(
	async ({ data }: { data: { preferences: ChaalPreferences } }): Promise<ChaalPreferences> => data.preferences,
).mockName("setChaalPreferences");
export const importChaalPreferences = fn(
	async ({ data }: { data: { preferences: ChaalPreferences } }): Promise<ChaalPreferences> =>
		data.preferences ?? DEFAULT_CHAAL_PREFERENCES,
).mockName("importChaalPreferences");
