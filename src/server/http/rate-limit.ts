import "@tanstack/react-start/server-only";
import { sql } from "drizzle-orm";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { rateLimit } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * Recipe (docs/guides/recipes.md, "Rate limiting server functions"; decision 0146):
 * a fixed-window limit stored in Postgres, so every server instance shares it.
 *
 * It uses Better Auth's `rate_limit` table (key, count, last_request), which
 * already exists, with keys prefixed `fn:` so they never collide with Better
 * Auth's own (which are paths). One upsert per call: a new window resets the
 * count, otherwise it goes up by one.
 */
export type RateLimitRule = {
	/** Calls allowed per window. */
	max: number;
	/** Window length in seconds. */
	windowSeconds: number;
};

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function consumeRateLimit(
	db: Db,
	key: string,
	{ max, windowSeconds }: RateLimitRule,
	now = Date.now(),
): Promise<RateLimitResult> {
	const id = `fn:${key}`;
	const windowStart = now - windowSeconds * 1000;
	const [row] = await db
		.insert(rateLimit)
		.values({ id, key: id, count: 1, lastRequest: now })
		.onConflictDoUpdate({
			target: rateLimit.key,
			set: {
				// A window that has passed starts again at 1 (and from now); otherwise one more call.
				count: sql`case when ${rateLimit.lastRequest} <= ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
				lastRequest: sql`case when ${rateLimit.lastRequest} <= ${windowStart} then ${now} else ${rateLimit.lastRequest} end`,
			},
		})
		.returning({ count: rateLimit.count, lastRequest: rateLimit.lastRequest });
	const count = row?.count ?? 1;
	const started = row?.lastRequest ?? now;
	return {
		allowed: count <= max,
		remaining: Math.max(0, max - count),
		retryAfterSeconds: Math.max(0, Math.ceil((started + windowSeconds * 1000 - now) / 1000)),
	};
}

/** Throws the localized "too many attempts" error when `key` is over its limit. */
export async function enforceRateLimit(db: Db, key: string, rule: RateLimitRule, now?: number) {
	const result = await consumeRateLimit(db, key, rule, now);
	if (!result.allowed) {
		throw ruleError("RATE_LIMITED", `Rate limited: ${key}`, m.error_rate_limited());
	}
	return result;
}
