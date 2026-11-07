import { z } from "zod";
import { clientEnv } from "@/lib/env/client";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";

/**
 * Links' inputs (decision 0191), checked on the server and by the forms. A slug is
 * the short link's path; a target is where it sends people.
 */
const id = z.uuid();

export const SLUG_MAX = 32;
export const LINK_SLUG_PATTERN = /^[a-z0-9-]{3,32}$/;
export const TARGET_MAX = 2048;
export const LINK_TITLE_MAX = 120;

/**
 * Slugs nobody may take: words that read like this site's own pages or like an
 * official notice, so a short link can't pass for one.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
	"admin",
	"api",
	"app",
	"apps",
	"auth",
	"dev",
	"help",
	"home",
	"links",
	"login",
	"logout",
	"new",
	"notes",
	"official",
	"privacy",
	"register",
	"security",
	"settings",
	"signin",
	"signup",
	"support",
	"terms",
	"upgrade",
	"verify",
	"www",
]);

/**
 * A host name as a site: without a trailing dot or a leading "www." (URL already drops
 * the case and the default port), so `www.example.com.` is `example.com`.
 */
const siteOf = (hostname: string) => hostname.replace(/\.$/, "").replace(/^www\./, "");

/** The site short links live on (a target there would loop or pass for this site), on any port. */
const siteHost = () => siteOf(new URL(clientEnv.VITE_SITE_URL).hostname);

/** Why `value` can't be a target, as a message, or null when it can. */
export function targetProblem(value: string): string | null {
	if (value.length > TARGET_MAX) return m.links_error_target_long({ max: formatNumber(TARGET_MAX) });
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return m.links_error_target_url();
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return m.links_error_target_url();
	if (url.username || url.password) return m.links_error_target_url();
	if (siteOf(url.hostname) === siteHost()) return m.links_error_target_self();
	return null;
}

export const linkSlug = () =>
	z
		.string()
		.trim()
		.toLowerCase()
		.regex(LINK_SLUG_PATTERN, { error: () => m.links_error_slug() })
		.refine((value) => !RESERVED_SLUGS.has(value), { error: () => m.links_error_slug_reserved() });

export const linkTarget = () =>
	z
		.string({ error: () => m.validation_required() })
		.trim()
		.min(1, { error: () => m.validation_required() })
		.superRefine((value, ctx) => {
			const problem = targetProblem(value);
			if (problem) ctx.addIssue({ code: "custom", message: problem });
		});

const title = () => z.string().trim().max(LINK_TITLE_MAX);
/** An expiry: an instant (the form sends the end of the chosen day in the app's time zone), or none. */
const expiresAt = () => z.iso.datetime({ offset: true }).nullable();

/** A new link: the slug is optional (a random one is picked). */
export const createLinkInput = z.strictObject({
	target: linkTarget(),
	slug: z.union([z.literal(""), linkSlug()]),
	title: title(),
	expiresAt: expiresAt(),
});

export const updateLinkInput = z.strictObject({
	id,
	target: linkTarget().optional(),
	title: title().optional(),
	active: z.boolean().optional(),
	expiresAt: expiresAt().optional(),
});

export const linkIdInput = z.strictObject({ id });

export type CreateLinkInput = z.infer<typeof createLinkInput>;
export type UpdateLinkInput = z.infer<typeof updateLinkInput>;
