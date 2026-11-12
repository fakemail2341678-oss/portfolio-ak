import { linkOptions } from "@tanstack/react-router";

/**
 * Every link into Kharcha (PLAN 14.2, "Name"): pages link through these, so renaming the
 * app is a move of `src/routes/_kharcha/app/kharcha` and this file. Each task adds its pages.
 */
export const kharchaLinks = {
	landing: () => linkOptions({ to: "/app/kharcha" }),
	signIn: (redirect?: string) => linkOptions({ to: "/app/kharcha/sign-in", search: { redirect } }),
	signUp: (redirect?: string) => linkOptions({ to: "/app/kharcha/sign-up", search: { redirect } }),
	home: () => linkOptions({ to: "/app/kharcha/home" }),
	account: () => linkOptions({ to: "/app/kharcha/account" }),
};

/** De-localized paths for redirects and `?redirect=` targets. */
export const KHARCHA_PATHS = { landing: "/app/kharcha", home: "/app/kharcha/home" } as const;

/** Kharcha's indexable pages (PLAN 14.5 "SEO"): the sitemap lists them. */
export const KHARCHA_SITEMAP = ["/app/kharcha"] as const;
