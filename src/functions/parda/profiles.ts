import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { KIDS_CAPS } from "@/features/parda/kids";
import { MAX_PROFILES, PROFILE_AVATARS, TMDB_REGIONS } from "@/features/parda/profiles/options";
import type { ProfileSummary, ProfilesData } from "@/features/parda/profiles/types";
import { zodInput } from "@/functions/_lib/validator";
import { requirePardaViewer, withPardaServices } from "@/middleware/parda";
import { locales } from "@/paraglide/runtime";
import { serverEnv } from "@/server/env";
import type { PardaProfileRow } from "@/server/parda/profiles/repository";
import * as profiles from "@/server/parda/profiles/service";

/**
 * Parda's profiles (PLAN Task 67, decision 0240): the picker, adding, changing and
 * deleting profiles, PIN locks, and the account's email digest. Each runs
 * `requirePardaViewer` then `withPardaServices`, and acts on the caller's own profiles
 * only; a kids' profile can only switch (tests/server/parda-access.test.ts).
 */

const locale = z.enum(locales);
const profileId = z.uuid();
const fields = {
	name: z.string().trim().min(1).max(30),
	avatar: z.enum(PROFILE_AVATARS).nullable(),
	kids: z.boolean(),
	cap: z.enum(KIDS_CAPS).nullable(),
	region: z.enum(TMDB_REGIONS as [string, ...string[]]).nullable(),
	audioLanguage: locale.nullable(),
	autoplay: z.boolean(),
};
const pin = z.string().regex(/^\d{4}$/);

/** A year: the browser keeps its choice of profile until it chooses another. */
const COOKIE_MAX_AGE = 365 * 86_400;

const remember = (value: string) =>
	setCookie(profiles.PROFILE_COOKIE, value, {
		httpOnly: true,
		sameSite: "lax",
		secure: serverEnv.BETTER_AUTH_URL.startsWith("https:"),
		path: "/",
		maxAge: COOKIE_MAX_AGE,
	});

const summary = (row: PardaProfileRow): ProfileSummary => ({
	id: row.id,
	name: row.name,
	avatar: row.avatar,
	kids: row.kids,
	cap: row.cap,
	locked: row.pinHash !== null,
	region: row.region,
	audioLanguage: (locales as ReadonlyArray<string>).includes(row.audioLanguage ?? "")
		? (row.audioLanguage as ProfileSummary["audioLanguage"])
		: null,
	autoplay: row.autoplay,
	isDefault: row.isDefault,
});

export const getPardaProfiles = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ locale })))
	.handler(async ({ data, context }): Promise<ProfilesData> => {
		const [rows, digest, settings] = await Promise.all([
			profiles.profilesOf(context.db, context.viewer.userId),
			context.viewer.isGuest ? Promise.resolve(null) : profiles.digestOf(context.db, context.viewer.userId),
			context.catalog?.services.controls.settings() ?? Promise.resolve(null),
		]);
		const names = new Intl.DisplayNames([data.locale === "ne" ? "ne-NP" : "en"], { type: "region" });
		return {
			active: context.viewer.profile.id,
			canManage: !context.viewer.profile.kids,
			profiles: rows.map(summary),
			max: MAX_PROFILES,
			isGuest: context.viewer.isGuest,
			digest,
			defaultCap: settings && "kidsCap" in settings ? settings.kidsCap : "PG",
			regions: TMDB_REGIONS.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
				a.name.localeCompare(b.name, data.locale),
			),
			languages: locales.filter((each) =>
				settings && "languages" in settings ? settings.languages.includes(each) : true,
			),
		};
	});

export const createPardaProfile = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject(fields)))
	.handler(async ({ data, context }): Promise<ProfileSummary> => summary(await profiles.createProfile(context, data)));

export const updatePardaProfile = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ id: profileId, ...fields })))
	.handler(async ({ data, context }): Promise<ProfileSummary> => {
		const { id, ...rest } = data;
		return summary(await profiles.updateProfile(context, id, rest));
	});

export const deletePardaProfile = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ id: profileId })))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await profiles.deleteProfile(context, data.id);
		return { ok: true };
	});

/** Locks a profile with a PIN, changes it, or (null) unlocks it. The active profile's cookie is renewed with it. */
export const setPardaProfilePin = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ id: profileId, pin: pin.nullable() })))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		const row = await profiles.setPin(context, data.id, data.pin);
		if (row.id === context.viewer.profile.id) remember(profiles.profileCookieValue(row));
		return { ok: true };
	});

/** Watches as another profile: a locked one needs its PIN (five tries per 15 minutes). */
export const switchPardaProfile = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ id: profileId, pin: pin.optional() })))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		remember(await profiles.switchProfile(context, data.id, data.pin));
		return { ok: true };
	});

/** The account's email digest of new episodes (decision 0241), in the page's language. Not for guests. */
export const setPardaDigest = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ digest: z.boolean(), locale: z.enum(locales) })))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await profiles.setDigest({ ...context, isGuest: context.viewer.isGuest }, data.digest, data.locale);
		return { ok: true };
	});
