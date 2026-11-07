import type { Locale } from "@/paraglide/runtime";

/** What the profiles page receives (decision 0240). */

export type ProfileSummary = {
	id: string;
	name: string;
	avatar: string | null;
	kids: boolean;
	/** A kids' profile's own cap; null follows the admin's (`defaultCap`). */
	cap: string | null;
	locked: boolean;
	region: string | null;
	audioLanguage: Locale | null;
	autoplay: boolean;
	isDefault: boolean;
};

export type ProfilesData = {
	active: string;
	/** False on a kids' profile: it can only switch. */
	canManage: boolean;
	profiles: ProfileSummary[];
	max: number;
	isGuest: boolean;
	/** The email digest; null for a guest (no email). */
	digest: boolean | null;
	defaultCap: string;
	/** TMDB's regions, named in the page's language on the server (browsers lack Nepali names). */
	regions: Array<{ code: string; name: string }>;
	/** The admin's players' languages: what an audio language can be. */
	languages: Locale[];
};
