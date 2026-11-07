import "@tanstack/react-start/server-only";
import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { PARDA_NAME } from "@/features/parda/brand";
import { episodeRangeLabel } from "@/features/parda/schedule/labels";
import { titleSlug } from "@/features/parda/slug";
import { localizedUrl } from "@/lib/seo";
import { pdAccount, pdNotification, pdProfile, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { sendEmail } from "@/server/email/send";
import type { EmailProvider } from "@/server/email/types";
import { errorFields, log } from "@/server/log";
import { titleKey } from "../controls";

/**
 * The new-episode digest (PLAN Task 68, decision 0241): after the daily check has
 * committed its alerts, one email per account that chose it (`pd_account.digest`), with
 * the unread alerts of all its profiles from the last week, as Taskline's digest does it
 * (decision 0214): a row is claimed (`emailed_at`) before the send, so a second run never
 * sends it again, and a failed send hands the rows back for tomorrow. Guests have no email.
 */

/** Alerts older than this aren't emailed (an account that opts in later gets a week's, not a season's). */
const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DIGEST_MAX_ITEMS = 30;

export type DigestResult = { sent: number; failed: number };

export async function sendDigests(
	db: Db,
	blocked: ReadonlySet<string>,
	{ provider, now = new Date() }: { provider?: EmailProvider; now?: Date } = {},
): Promise<DigestResult> {
	const result: DigestResult = { sent: 0, failed: 0 };
	const rows = await db
		.select({
			id: pdNotification.id,
			tmdbId: pdNotification.tmdbId,
			season: pdNotification.season,
			episode: pdNotification.episode,
			lastEpisode: pdNotification.lastEpisode,
			data: pdNotification.data,
			readAt: pdNotification.readAt,
			userId: user.id,
			email: user.email,
			name: user.name,
			locale: pdAccount.locale,
		})
		.from(pdNotification)
		.innerJoin(pdProfile, eq(pdProfile.id, pdNotification.profileId))
		.innerJoin(user, eq(user.id, pdProfile.ownerId))
		.innerJoin(pdAccount, eq(pdAccount.userId, user.id))
		.where(
			and(
				isNull(pdNotification.emailedAt),
				gte(pdNotification.createdAt, new Date(now.getTime() - DIGEST_WINDOW_MS)),
				eq(pdAccount.digest, true),
				sql`${user.isAnonymous} is not true`,
			),
		)
		.orderBy(asc(user.id), asc(pdNotification.createdAt));
	const byUser = new Map<string, typeof rows>();
	for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);

	for (const group of byUser.values()) {
		const first = group[0];
		if (!first) continue;
		const claimed = await db
			.update(pdNotification)
			.set({ emailedAt: now })
			.where(
				and(
					inArray(
						pdNotification.id,
						group.map((row) => row.id),
					),
					isNull(pdNotification.emailedAt),
				),
			)
			.returning({ id: pdNotification.id });
		const mine = new Set(claimed.map((row) => row.id));
		// Read in the bell, or taken down since: claimed without an email.
		const unread = group.filter(
			(row) => mine.has(row.id) && row.readAt === null && !blocked.has(titleKey("tv", row.tmdbId)),
		);
		// Two profiles following one series get one line.
		const seen = new Set<string>();
		const items = unread.filter((row) => {
			const key = `${row.tmdbId}:${row.season}:${row.lastEpisode}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		if (items.length === 0) continue;
		const locale = first.locale === "ne" ? "ne" : "en";
		const watch = (row: (typeof rows)[number]) =>
			localizedUrl(
				`/app/parda/watch/series/${row.tmdbId}-${titleSlug(row.data.title.en)}?s=${row.season}&e=${row.episode}`,
				locale,
			);
		try {
			await sendEmail(
				{
					to: first.email,
					template: "parda-digest",
					locale,
					siteName: PARDA_NAME,
					data: {
						name: first.name,
						items: items.slice(0, DIGEST_MAX_ITEMS).map((row) => ({
							id: row.id,
							title: (locale === "ne" ? row.data.title.ne : "") || row.data.title.en,
							episodes: episodeRangeLabel(row, locale),
							url: watch(row),
						})),
						more: Math.max(0, items.length - DIGEST_MAX_ITEMS),
						url: localizedUrl("/app/parda/schedule", locale),
						settingsUrl: localizedUrl("/app/parda/profiles", locale),
					},
				},
				provider,
			);
			result.sent++;
		} catch (error) {
			result.failed++;
			await db
				.update(pdNotification)
				.set({ emailedAt: null })
				.where(inArray(pdNotification.id, [...mine]));
			log("error", "parda digest email failed", { userId: first.userId, ...errorFields(error) });
		}
	}
	return result;
}
