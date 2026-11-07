import type { AppSlug } from "./registry";

/** /admin/apps (decision 0187): guests now, and per app who has data and how many rows. */
export type AppsUsage = {
	/** Guest sessions alive now (each is deleted a week after it started). */
	guests: number;
	apps: Array<{ slug: AppSlug; accounts: number; guests: number; rows: Record<string, number> }>;
	generatedAt: string;
};
