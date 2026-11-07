import { createFileRoute } from "@tanstack/react-router";
import { PublicFormPage } from "@/features/apps/forms/components/public-form-page";
import { publicFormParamsSchema } from "@/features/apps/forms/search";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { loadDetailOr404 } from "@/lib/crud/route";
import { fontPreloads } from "@/lib/fonts";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { noindexHeaderMiddleware } from "@/middleware/robots";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/**
 * /f/$slug: a published form from the Forms app (decision 0195), for anyone with the
 * link; a draft, a guest's form or an unknown slug is the localized 404. Never
 * indexed: noindex in the head and in an X-Robots-Tag header. It reads no session
 * (the respondent has none), and renders its own frame.
 */
export const Route = createFileRoute("/f/$slug")({
	params: { parse: (raw) => parseParams(publicFormParamsSchema, raw) },
	server: { middleware: [noindexHeaderMiddleware] },
	staticData: { session: "skip" },
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { publicFormQueryOptions } = await import("@/features/apps/forms/queries");
		const [form] = await Promise.all([
			loadDetailOr404(context.queryClient, publicFormQueryOptions(params.slug)),
			// The form needs Turnstile's site key (when configured).
			ensureQuery(context.queryClient, authFeaturesQueryOptions()),
		]);
		return { title: form.title };
	},
	head: ({ loaderData }) => ({
		...privateHead(loaderData?.title ?? m.forms_name()),
		links: fontPreloads(getLocale()),
	}),
	component: PublicFormPage,
});
