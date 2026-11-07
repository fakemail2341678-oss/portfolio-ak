import { createFileRoute, redirect } from "@tanstack/react-router";
import { FormResultsPage } from "@/features/apps/forms/components/form-results";
import { formParamsSchema, formResultsSearchSchema } from "@/features/apps/forms/search";
import { listSearch, loadDetailOr404 } from "@/lib/crud/route";
import { parseParams } from "@/lib/list/params";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/forms/$formId/results: a form's results and responses (private; someone else's is a 404). */
export const Route = createFileRoute("/_apps/apps/forms/$formId/results")({
	params: { parse: (raw) => parseParams(formParamsSchema, raw) },
	...listSearch(formResultsSearchSchema, formResultsSearchSchema.parse({})),
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/apps/forms" });
		return { session: context.session };
	},
	loaderDeps: ({ search }) => ({ page: search.page }),
	loader: async ({ context, params, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { formResultsQueryOptions } = await import("@/features/apps/forms/queries");
		const results = await loadDetailOr404(
			context.queryClient,
			formResultsQueryOptions(context.session.user.id, params.formId, deps.page),
		);
		return { title: results.form.title };
	},
	head: ({ loaderData }) => privateHead(m.forms_results_title({ title: loaderData?.title ?? m.forms_name() })),
	component: FormResultsPage,
});
