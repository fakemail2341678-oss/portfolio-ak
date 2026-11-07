import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Breadcrumbs } from "@/components/page/breadcrumbs";
import { Page, PageHeader } from "@/components/page/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRIORITY_LABELS } from "@/features/dev/examples/labels";
import { exampleTaskQueryOptions } from "@/features/dev/examples/queries";
import { exampleTaskIdSchema } from "@/features/dev/examples/schema";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { isAppError } from "@/lib/errors";
import { formatDate } from "@/lib/i18n/intl";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { setErrorStatus } from "@/lib/start/http-status";
import { m } from "@/paraglide/messages";

/**
 * The task's own page: what the masked link's URL shows on reload, in a new tab
 * or without JavaScript. Invalid ids don't match the route (params.parse), so
 * they get the localized 404 without a request.
 */
export const Route = createFileRoute("/dev/examples/masking/$id")({
	params: { parse: (raw) => parseParams(exampleTaskIdSchema, raw) },
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { exampleTaskQueryOptions } = await import("@/features/dev/examples/queries");
		try {
			const task = await ensureQuery(context.queryClient, exampleTaskQueryOptions(params.id));
			return { title: task.title };
		} catch (error) {
			if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
			await setErrorStatus(error);
			throw error;
		}
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: ({ loaderData }) => privateHead(loaderData?.title),
	component: TaskPage,
});

function TaskPage() {
	const { id } = Route.useParams();
	const { data: task } = useSuspenseQuery(exampleTaskQueryOptions(id));
	return (
		<Page width="narrow" className="gap-6">
			<Breadcrumbs />
			<PageHeader title={task.title} description={m.examples_masking_full_page()} />
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<Badge variant="secondary">{PRIORITY_LABELS[task.priority]()}</Badge>
				<span>{task.done ? m.examples_done() : m.examples_open()}</span>
				<span className="text-muted-foreground">{formatDate(task.createdAt, { dateStyle: "long" })}</span>
			</div>
			<div>
				<Button asChild variant="outline">
					<Link to="/dev/examples/masking">{m.examples_masking_back()}</Link>
				</Button>
			</div>
		</Page>
	);
}
