import { createFileRoute, redirect } from "@tanstack/react-router";
import { FormBuilderPage } from "@/features/apps/forms/components/form-builder";
import { formParamsSchema } from "@/features/apps/forms/search";
import { loadDetailOr404 } from "@/lib/crud/route";
import { parseParams } from "@/lib/list/params";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/forms/$formId: one of the user's forms in the builder (private; someone else's is a 404). */
export const Route = createFileRoute("/_apps/apps/forms/$formId/")({
	// Only UUIDs match; anything else is the localized 404 without a round trip.
	params: { parse: (raw) => parseParams(formParamsSchema, raw) },
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/apps/forms" });
		return { session: context.session };
	},
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { formQueryOptions } = await import("@/features/apps/forms/queries");
		const form = await loadDetailOr404(context.queryClient, formQueryOptions(context.session.user.id, params.formId));
		return { title: form.title };
	},
	head: ({ loaderData }) => privateHead(loaderData?.title ?? m.forms_name()),
	component: FormBuilderPage,
});
