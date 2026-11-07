import { createFileRoute } from "@tanstack/react-router";
import { Public__Pascal__Detail } from "@/features/__name__/components/__name__-public";
import { public__Pascal__DetailQueryOptions } from "@/features/__name__/queries";
import { __camel__SlugSchema } from "@/features/__name__/search";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404 } from "@/lib/crud/route";
{{#localized}}
import { localizedValue } from "@/lib/i18n/localized";
{{/localized}}
import { parseParams } from "@/lib/list/params";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/__name__/$slug")({
	// Not a valid slug -> can't exist: the localized 404 without a query.
	params: { parse: (raw) => parseParams(__camel__SlugSchema, raw) },
	// Missing and draft slugs are both the 404 page. Only what head() and the breadcrumb need.
	loader: async ({ context, params }) => {
		const item = await loadDetailOr404(context.queryClient, public__Pascal__DetailQueryOptions(params.slug));
		return {
			title: {{#localized}}localizedValue(item.title){{/localized}}{{^localized}}item.title{{/localized}},
			description: {{#localized}}localizedValue(item.notes){{/localized}}{{^localized}}item.notes{{/localized}}.slice(0, 160),
		};
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: ({ loaderData, params }) =>
		seo({
			title: loaderData?.title,
			// Short notes say too little for search results: the section's description instead.
			description:
				loaderData && loaderData.description.length > 20 ? loaderData.description : m.__snake___public_description(),
			path: `/__name__/${params.slug}`,
		}),
	component: Public__Pascal__Detail,
});
