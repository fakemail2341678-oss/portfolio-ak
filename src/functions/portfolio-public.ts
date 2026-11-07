import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { contactInputSchema } from "@/features/portfolio/schema";
import { portfolioSlugParamSchema } from "@/features/portfolio/search";
import type {
	AboutContent,
	HomeContent,
	PostDetail,
	PostSummary,
	Profile,
	ProjectDetail,
	ProjectSummary,
} from "@/features/portfolio/types";
import { hasAll } from "@/features/rbac/permissions";
import { zodInput } from "@/functions/_lib/validator";
import { withPublicServices } from "@/middleware/services";
import { locales } from "@/paraglide/runtime";
import { clientIpHash, trustedClientIp } from "@/server/auth/client-ip";
import { getServerSession } from "@/server/auth/session";
import { sendEmail } from "@/server/email/send";
import { serverEnv } from "@/server/env";
import { verifyTurnstile } from "@/server/http/turnstile";
import { submitContact } from "@/server/portfolio/messages-service";
import * as portfolio from "@/server/portfolio/public";

/**
 * The portfolio's public reads and its contact form (decision 0176). No
 * permission: the reads return published content only, and a draft looks
 * exactly like a missing slug, except in a preview (`preview: true`), which
 * the server grants only to a signed-in holder of portfolio:read (the pages
 * never look the session up otherwise, 0161). The locale is an input, so a
 * client-side navigation reads the language of the page it goes to.
 */

const locale = z.enum(locales);
const pageInput = z.strictObject({ locale });
const detailInput = portfolioSlugParamSchema.extend({ locale, preview: z.boolean().optional() }).strict();

/** Drafts show only to someone signed in who may read them. */
const canPreview = async (preview: boolean | undefined) => {
	if (!preview) return false;
	const session = await getServerSession();
	return session !== null && hasAll(session.permissions, ["portfolio:read"]);
};

export const getPublicProfile = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(pageInput))
	.handler(({ data, context }): Promise<Profile> => portfolio.getProfile(context, data));

export const getHome = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(pageInput))
	.handler(({ data, context }): Promise<HomeContent> => portfolio.getHome(context, data));

export const getWork = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(pageInput))
	.handler(({ data, context }): Promise<ProjectSummary[]> => portfolio.listProjects(context, data));

export const getCaseStudy = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(detailInput))
	.handler(
		async ({ data, context }): Promise<ProjectDetail | null> =>
			portfolio.getProject(context, data.slug, { locale: data.locale, drafts: await canPreview(data.preview) }),
	);

export const getAbout = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(pageInput))
	.handler(({ data, context }): Promise<AboutContent> => portfolio.getAbout(context, data));

export const getJournal = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(pageInput))
	.handler(({ data, context }): Promise<PostSummary[]> => portfolio.listPosts(context, data));

export const getArticle = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(detailInput))
	.handler(
		async ({ data, context }): Promise<PostDetail | null> =>
			portfolio.getPost(context, data.slug, { locale: data.locale, drafts: await canPreview(data.preview) }),
	);

// apps:start
/** Published case studies of the showcase apps (the apps' header links to them). */
export const getAppCaseStudies = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.handler(({ context }): Promise<Array<{ app: string; slug: string }>> => portfolio.listAppCaseStudies(context.db));
// apps:end

/**
 * The contact form: honeypot, Turnstile when configured and a rate limit per
 * sender, then the message is saved for the inbox and emailed to the owner.
 */
export const submitContactMessage = createServerFn({ method: "POST" })
	.middleware([withPublicServices])
	.validator(zodInput(contactInputSchema))
	.handler(({ data, context }): Promise<{ sent: true }> => {
		const ip = trustedClientIp(getRequest());
		const secret = serverEnv.TURNSTILE_SECRET_KEY;
		return submitContact(context, data, {
			ipHash: clientIpHash(ip),
			verifyCaptcha: secret ? (token) => verifyTurnstile(secret, token, ip) : null,
			send: sendEmail,
		});
	});
