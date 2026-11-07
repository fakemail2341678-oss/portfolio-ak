import { Await, createFileRoute } from "@tanstack/react-router";
import { DescriptionList } from "@/components/data-display/description-list";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Streaming: the loader returns a promise WITHOUT awaiting it. The page's HTML
 * is sent at once with the fallback; the value streams into the same response
 * when ready and <Await> swaps it in. Use it for slow, non-essential parts
 * (here 1.5 s); what the page needs to make sense is awaited as usual.
 * The fallback reserves the result's height, so nothing shifts.
 */
export const Route = createFileRoute("/dev/examples/streaming")({
	loader: async () => {
		// On demand: the server functions stay out of every page's JavaScript (0194).
		const { getSlowExample } = await import("@/functions/examples");
		return { slow: getSlowExample() };
	},
	staticData: { breadcrumb: staticCrumb(m.examples_streaming_title) },
	head: () => privateHead(m.examples_streaming_title()),
	component: StreamingExample,
});

function StreamingExample() {
	const { slow } = Route.useLoaderData();
	return (
		<ExamplePage slug="streaming">
			<Demo title={m.examples_streaming_demo()} note={m.examples_streaming_note()}>
				<div className="min-h-14">
					<Await
						promise={slow}
						fallback={
							<p className="text-muted-foreground text-sm" data-testid="stream-fallback">
								{m.examples_streaming_waiting()}
							</p>
						}
					>
						{(value) => (
							<DescriptionList
								items={[
									{
										label: m.examples_streaming_took(),
										value: m.examples_ms({ value: formatNumber(value.tookMs) }),
										testId: "stream-value",
									},
									{
										label: m.examples_streaming_finished(),
										value: <time dateTime={value.finishedAt}>{formatDateTime(value.finishedAt)}</time>,
									},
								]}
							/>
						)}
					</Await>
				</div>
			</Demo>
		</ExamplePage>
	);
}
