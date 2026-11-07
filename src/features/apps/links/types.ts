/** Links' limits per user (decision 0191): a guest's links count the same. */
export const LINKS_QUOTAS = { links: 200, createsPerHour: 30 } as const;

/** Where a short link lives: /l/<slug> on this site. */
export const SHORT_LINK_PREFIX = "/l/";

/** Why a link doesn't redirect right now, or "live". */
export const LINK_STATES = ["live", "paused", "expired", "blocked", "guest"] as const;
export type LinkState = (typeof LINK_STATES)[number];

export const LINK_DEVICES = ["desktop", "mobile", "tablet", "bot"] as const;
export type LinkDevice = (typeof LINK_DEVICES)[number];

export type LinkItem = {
	id: string;
	slug: string;
	target: string;
	title: string;
	active: boolean;
	expiresAt: string | null;
	blocked: boolean;
	state: LinkState;
	clicks: number;
	createdAt: string;
};

export type LinkList = { links: LinkItem[]; now: string };

/** One count per bucket: a day ("2026-10-30"), a referrer host, a country code or a device class. */
export type Tally = { key: string; clicks: number };

export type LinkStats = {
	link: LinkItem;
	/** The last 30 days in the app's time zone, oldest first, days without clicks included. */
	days: Tally[];
	/** Most clicks first, at most 8; `key` "" is direct (no referrer) or unknown (no country). */
	referrers: Tally[];
	countries: Tally[];
	devices: Tally[];
	total: number;
};
