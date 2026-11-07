import type { ReactNode } from "react";
import { DescriptionList } from "@/components/data-display/description-list";
import { Breadcrumbs } from "@/components/page/breadcrumbs";
import { FormCard } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { m } from "@/paraglide/messages";
import { type ExampleSlug, exampleBySlug } from "./registry";

/** The frame of every example page: title, what it shows, where the code and the guide are. */
export function ExamplePage({ slug, children }: { slug: ExampleSlug; children: ReactNode }) {
	const example = exampleBySlug(slug);
	return (
		<Page className="gap-8">
			<Breadcrumbs />
			<PageHeader title={example.title()} description={example.description()}>
				<DescriptionList
					className="text-caption [&_dd]:font-mono"
					items={[
						{ label: m.examples_source(), value: example.source },
						{ label: m.examples_guide(), value: example.guide },
					]}
				/>
			</PageHeader>
			{children}
		</Page>
	);
}

/** One part of an example: a kit card with its heading (h2) and an optional note. */
export function Demo({
	title,
	note,
	children,
	className,
}: {
	title: string;
	note?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<FormCard title={title} description={note} className={className}>
			{children}
		</FormCard>
	);
}
