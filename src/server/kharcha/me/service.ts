import "@tanstack/react-start/server-only";
import { eq, sql } from "drizzle-orm";
import type { OnboardingInput, ProfileInput } from "@/features/kharcha/schema";
import { offeredCurrencies } from "@/features/kharcha/settings";
import type { Amount, KharchaBalances, KharchaMe, KharchaPulse } from "@/features/kharcha/types";
import { todayInZone } from "@/lib/i18n/date-only";
import { getLocale } from "@/paraglide/runtime";
import { notFound } from "@/server/db/crud";
import { khProfile } from "@/server/db/schema";
import { type KharchaServices, resolveMe } from "../access";
import { byCurrency, pairBalances } from "../ledger";
import { notifySettingsOf, unreadCount } from "../notify/inbox";
import { personDto } from "../people";
import { bumpRevs, revOf } from "../rev";
import { assertCurrencyOffered } from "../rules";
import { getSettings, quotasFor } from "../settings";

/** The caller's own reads (docs/guides/kharcha.md "The caller"): who they are in Kharcha, their `rev` and their totals. */

export async function getMe({ db, user }: KharchaServices): Promise<KharchaMe> {
	const me = await resolveMe(db, user);
	const [profile] = await db.select().from(khProfile).where(eq(khProfile.userId, user.id));
	if (!profile) throw notFound("Profile");
	const settings = await getSettings(db);
	return {
		person: personDto(me.person, me.personId),
		profile: {
			homeCurrency: profile.homeCurrency,
			timeZone: profile.timeZone,
			defaultSplit: profile.defaultSplit,
			payNote: profile.payNote,
			onboarded: profile.onboardedAt !== null,
			start: profile.start,
			notify: notifySettingsOf(profile.notify as Record<string, string>),
			focus: profile.focus,
		},
		today: todayInZone(profile.timeZone),
		currencies: offeredCurrencies(settings),
		receiptsMax: quotasFor(settings, user).receipts,
		rev: profile.rev,
		isGuest: user.isGuest,
	};
}

/** The caller's `rev`; 0 before their first use. */
export const getRev = ({ db, user }: KharchaServices): Promise<number> => revOf(db, user.id);

/** What open pages poll (PLAN 14.5 "Freshness"): the `rev` and the bell's count (Task 92), two indexed reads, no writes. */
export async function getPulse({ db, user }: KharchaServices): Promise<KharchaPulse> {
	const [rev, unread] = await Promise.all([getRev({ db, user }), unreadCount(db, user.id)]);
	return { rev, unread };
}

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
				locale: getLocale(),
				onboardedAt: sql`coalesce(${khProfile.onboardedAt}, now())`,
			})
			.where(eq(khProfile.userId, user.id));
		await bumpRevs(tx, [me.personId]);
	});
}

/**
 * Settings → Profile (Task 91): the home currency (one the admin offers), the time zone, and
 * the pay note friends see when they settle up. Saving also keeps the visit's language as the
 * language of their emails (a reminder from a friend arrives in it).
 */
export async function updateProfile({ db, user }: KharchaServices, input: ProfileInput): Promise<KharchaMe> {
	const me = await resolveMe(db, user);
	assertCurrencyOffered(await getSettings(db), input.homeCurrency);
	await db.transaction(async (tx) => {
		await tx
			.update(khProfile)
			.set({
				homeCurrency: input.homeCurrency,
				timeZone: input.timeZone,
				payNote: (input.payNote ?? "").trim(),
				locale: getLocale(),
			})
			.where(eq(khProfile.userId, user.id));
		await bumpRevs(tx, [me.personId]);
	});
	return getMe({ db, user });
}
