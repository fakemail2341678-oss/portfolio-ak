import { fn } from "storybook/test";
import type { LabPlayer, LabSource } from "../../../../src/features/parda/admin/schema";

// Stand-ins for src/functions/parda-admin/player-lab.ts.
const sampleSource: LabSource = {
	id: "00000000-0000-4000-8000-000000000001",
	name: { en: "Server 1", ne: "सर्भर १" },
	adapter: "parda",
	enabled: true,
	sandbox: "none",
};

export const listPardaLabSources = fn(async (): Promise<LabSource[]> => [sampleSource]).mockName("listPardaLabSources");
export const openPardaLabPlayer = fn(
	async (): Promise<LabPlayer> => ({
		url: "/parda/api/1/movie/550",
		origins: [],
		adapter: "parda",
		sandbox: "none",
		name: sampleSource.name,
	}),
).mockName("openPardaLabPlayer");
