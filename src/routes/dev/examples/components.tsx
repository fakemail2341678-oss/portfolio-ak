import { createFileRoute } from "@tanstack/react-router";
import { KitComponentsExample } from "@/features/dev/examples/kit-components";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** The admin kit's components on one page (src/features/dev/examples/kit-components.tsx). */
export const Route = createFileRoute("/dev/examples/components")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { kitComponentsQueryOptions } = await import("@/features/dev/examples/queries");
		await ensureQuery(context.queryClient, kitComponentsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.examples_components_title) },
	head: () => privateHead(m.examples_components_title()),
	component: KitComponentsExample,
});
