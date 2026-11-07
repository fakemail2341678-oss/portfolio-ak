import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { Breadcrumbs } from "@/components/page/breadcrumbs";
import { Page, PageHeader } from "@/components/page/page";
import { EXAMPLES } from "@/features/dev/examples/registry";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /dev/examples: one small, real page per module (development only, see ../route.tsx). */
export const Route = createFileRoute("/dev/examples/")({
	head: () => privateHead(m.examples_title()),
	component: ExamplesIndex,
});

function ExamplesIndex() {
	return (
		<Page className="gap-8">
			<Breadcrumbs />
			<PageHeader title={m.examples_title()} description={m.examples_description()} />
			<ul className="grid gap-4 sm:grid-cols-2" data-testid="examples-list">
				{EXAMPLES.map((example) => (
					<li key={example.slug}>
						<Link
							to={`/dev/examples/${example.slug}`}
							className="group flex h-full flex-col gap-1 rounded-xl border p-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
						>
							<span className="flex items-center justify-between gap-2 font-medium">
								{example.title()}
								<ArrowRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
							</span>
							<span className="text-muted-foreground text-sm">{example.description()}</span>
						</Link>
					</li>
				))}
			</ul>
		</Page>
	);
}
