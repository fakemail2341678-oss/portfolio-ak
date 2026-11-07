import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DescriptionList } from "@/components/data-display/description-list";
import { Button } from "@/components/ui/button";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { exampleSnapshotQueryOptions } from "@/features/dev/examples/queries";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Loader + Query, the SSR pattern of every page:
 * 1. the loader awaits ensureQuery (on the server for the first request);
 * 2. the result is dehydrated into the HTML with the Query cache;
 * 3. the component reads it with useSuspenseQuery: no request while hydrating.
 * The loader returns nothing: the data lives in the Query cache, not in loader data.
 */
export const Route = createFileRoute("/dev/examples/loader-query")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { exampleSnapshotQueryOptions } = await import("@/features/dev/examples/queries");
		await ensureQuery(context.queryClient, exampleSnapshotQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.examples_loader_title) },
	head: () => privateHead(m.examples_loader_title()),
	component: LoaderQueryExample,
});

function LoaderQueryExample() {
	const { data, isFetching, refetch } = useSuspenseQuery(exampleSnapshotQueryOptions());
	return (
		<ExamplePage slug="loader-query">
			<Demo title={m.examples_loader_demo()} note={m.examples_loader_note()}>
				<DescriptionList
					items={[
						{ label: m.examples_loader_calls(), value: formatNumber(data.calls), testId: "snapshot-calls" },
						{
							label: m.examples_loader_rendered(),
							value: <time dateTime={data.renderedAt}>{formatDateTime(data.renderedAt)}</time>,
						},
					]}
				/>
				<div>
					<Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
						{isFetching ? m.examples_working() : m.examples_loader_refetch()}
					</Button>
				</div>
			</Demo>
		</ExamplePage>
	);
}
