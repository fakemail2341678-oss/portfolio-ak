import { fn } from "storybook/test";
import type { ProfileSummary, ProfilesData } from "../../../../src/features/parda/profiles/types";

// Stand-ins for src/functions/parda/profiles.ts: two profiles, one of them a kids' one, and nothing saved.
const PROFILES: ProfileSummary[] = [
	{
		id: "00000000-0000-4000-8000-000000000000",
		name: "Me",
		avatar: "sun",
		kids: false,
		cap: null,
		locked: true,
		region: null,
		audioLanguage: null,
		autoplay: true,
		isDefault: true,
	},
	{
		id: "00000000-0000-4000-8000-000000000001",
		name: "Kid",
		avatar: "star",
		kids: true,
		cap: "PG",
		locked: false,
		region: null,
		audioLanguage: null,
		autoplay: true,
		isDefault: false,
	},
];

export const getPardaProfiles = fn(
	async (): Promise<ProfilesData> => ({
		active: PROFILES[0]?.id ?? "",
		canManage: true,
		profiles: PROFILES,
		max: 5,
		isGuest: false,
		digest: false,
		defaultCap: "PG",
		regions: [
			{ code: "IN", name: "India" },
			{ code: "US", name: "United States" },
		],
		languages: ["en", "ne"],
	}),
).mockName("getPardaProfiles");
export const createPardaProfile = fn(async (): Promise<ProfileSummary> => PROFILES[1] as ProfileSummary).mockName(
	"createPardaProfile",
);
export const updatePardaProfile = fn(async (): Promise<ProfileSummary> => PROFILES[1] as ProfileSummary).mockName(
	"updatePardaProfile",
);
export const deletePardaProfile = fn(async () => ({ ok: true as const })).mockName("deletePardaProfile");
export const setPardaProfilePin = fn(async () => ({ ok: true as const })).mockName("setPardaProfilePin");
export const switchPardaProfile = fn(async () => ({ ok: true as const })).mockName("switchPardaProfile");
export const setPardaDigest = fn(async () => ({ ok: true as const })).mockName("setPardaDigest");
