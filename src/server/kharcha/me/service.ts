import "@tanstack/react-start/server-only";
import { eq, sql } from "drizzle-orm";
import type { OnboardingInput } from "@/features/kharcha/schema";
import { offeredCurrencies } from "@/features/kharcha/settings";
import type { Amount, KharchaBalances, KharchaMe } from "@/features/kharcha/types";
import { todayInZone } from "@/lib/i18n/date-only";
import { notFound } from "@/server/db/crud";
import { khProfile } from "@/server/db/schema";
import { type KharchaServices, resolveMe } from "../access";
import { byCurrency, pairBalances } from "../ledger";
import { personDto } from "../people";
import { bumpRevs, revOf } from "../rev";
import { assertCurrencyOffered } from "../rules";
import { getSettings } from "../settings";

/** The caller's own reads (docs/guides/kharcha.md "The caller"): who they are in Kharcha, their `rev` and their totals. */

export async function getMe({ db, user }: KharchaServices): Promise<KharchaMe> {
	const me = await resolveMe(db, user);
	const [profile] = await db.select().from(khProfile).where(eq(khProfile.userId, user.id));
	if (!profile) throw notFound("Profile");
	return {
		person: personDto(me.person, me.personId),
		profile: {
			homeCurrency: profile.homeCurrency,
			timeZone: profile.timeZone,
			defaultSplit: profile.defaultSplit,
			payNote: profile.payNote,
			onboarded: profile.onboardedAt !== null,
			start: profile.start,
		},
		today: todayInZone(profile.timeZone),
		currencies: offeredCurrencies(await getSettings(db)),
		rev: profile.rev,
		isGuest: user.isGuest,
	};
}

/** What open pages poll (PLAN 14.5 "Freshness"): one indexed read, no writes. */
export const getRev = ({ db, user }: KharchaServices): Promise<number> => revOf(db, user.id);

/**
 * What the caller is owed and owes in all, per currency: the sum of what each person owes
 * them, and of what they owe each person. Not a net: being owed 500 by Asha doesn't pay
 * the 300 owed to Bikash.
 */
export async function getBalances({ db, user }: KharchaServices): Promise<KharchaBalances> {
	const me = await resolveMe(db, user);
	const owed = new Map<string, number>();
	const owe = new Map<string, number>();
	for (const balance of await pairBalances(db, me.personId)) {
		const side = balance.amountMinor > 0 ? owed : owe;
		side.set(balance.currency, (side.get(balance.currency) ?? 0) + Math.abs(balance.amountMinor));
	}
	const amounts = (side: Map<string, number>): Amount[] =>
		[...side].map(([currency, amountMinor]) => ({ currency, amountMinor })).sort(byCurrency);
	return { owed: amounts(owed), owe: amounts(owe) };
}

/**
 * Onboarding (Task 88): the home currency (one the admin offers), the time zone and what
 * they came for. Skipping sends what is set already; either way it is done, and the
 * dialog never comes back. Their own open pages refetch (`rev`).
 */
export async function completeOnboarding({ db, user }: KharchaServices, input: OnboardingInput): Promise<void> {
	const me = await resolveMe(db, user);
	assertCurrencyOffered(await getSettings(db), input.homeCurrency);
	await db.transaction(async (tx) => {
		await tx
			.update(khProfile)
			.set({
				homeCurrency: input.homeCurrency,
				timeZone: input.timeZone,
				start: input.start,
				onboardedAt: sql`coalesce(${khProfile.onboardedAt}, now())`,
			})
			.where(eq(khProfile.userId, user.id));
		await bumpRevs(tx, [me.personId]);
	});
}
