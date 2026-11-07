import "@tanstack/react-start/server-only";
import { count, eq } from "drizzle-orm";
import type { AppsUsage } from "@/features/apps/types";
import { user } from "@/server/db/schema";
import type { Services } from "@/server/services";
import { APP_SERVERS } from "./registry";

/**
 * /admin/apps' numbers (decision 0187): how many guests exist, and for each app how
 * many accounts and guests have data in it and how many rows of each kind. Counts
 * only: the admin area never reads what users wrote in an app.
 */
export async function getAppsUsage({ db }: Pick<Services, "db">, now = new Date()): Promise<AppsUsage> {
	const [guests, apps] = await Promise.all([
		db
			.select({ total: count() })
			.from(user)
			.where(eq(user.isAnonymous, true))
			.then(([row]) => row?.total ?? 0),
		Promise.all(APP_SERVERS.map(async (app) => ({ slug: app.slug, ...(await app.usage(db)) }))),
	]);
	return { guests, apps, generatedAt: now.toISOString() };
}
