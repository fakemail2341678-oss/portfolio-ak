import { createFileRoute } from "@tanstack/react-router";
import { FormsHome } from "@/features/apps/forms/components/forms-home";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/forms: the landing for visitors (indexable), the user's forms once they have a session. */
export const Route = createFileRoute("/_apps/apps/forms/")({
	loader: async ({ context }) => {
		if (!context.session) return;
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { formsListQueryOptions } = await import("@/features/apps/forms/queries");
		await ensureQuery(context.queryClient, formsListQueryOptions(context.session.user.id));
	},
	head: () => seo({ title: m.forms_name(), description: m.forms_seo_description(), path: "/apps/forms" }),
	component: FormsHome,
});
