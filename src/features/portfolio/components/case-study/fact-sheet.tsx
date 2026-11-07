import type { ReactNode } from "react";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { DISCIPLINE_LABELS } from "../../lib/labels";
import type { Project } from "../../types";
import { TextAnchor, TextLink } from "../primitives/links";
import { PlainList } from "../primitives/plain-list";

function Fact({ term, children }: { term: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="hm-meta">{term}</dt>
			<dd className="text-hm-body">{children}</dd>
		</div>
	);
}

type FactSheetProps = {
	project: Pick<Project, "role" | "client" | "year" | "duration" | "disciplines" | "stack" | "links">;
};

/** The project at a glance, on the section's own ground (no panel); pinned beside the story on wide screens. */
export function FactSheet({ project }: FactSheetProps) {
	return (
		<aside aria-labelledby="facts-title" className="md:sticky md:top-8">
			<h2 id="facts-title" className="sr-only">
				{m.portfolio_case_facts()}
			</h2>
			<dl className="flex flex-col gap-5">
				<Fact term={m.portfolio_case_role()}>{project.role}</Fact>
				<Fact term={m.portfolio_case_client()}>{project.client}</Fact>
				<Fact term={m.portfolio_case_year()}>{formatNumber(project.year, { useGrouping: false })}</Fact>
				<Fact term={m.portfolio_case_duration()}>{project.duration}</Fact>
				<Fact term={m.portfolio_case_disciplines()}>
					{project.disciplines.map((discipline) => DISCIPLINE_LABELS[discipline]()).join(", ")}
				</Fact>
				<Fact term={m.portfolio_case_stack()}>
					<PlainList items={project.stack} className="gap-x-3" />
				</Fact>
				{project.links.length > 0 ? (
					<Fact term={m.portfolio_case_links()}>
						<ul className="flex flex-col gap-1.5">
							{project.links.map((link) => (
								<li key={link.href}>
									<TextAnchor href={link.href} rel="noopener">
										{link.label}
									</TextAnchor>
								</li>
							))}
						</ul>
					</Fact>
				) : null}
			</dl>
			<p className="mt-7">
				<TextLink to="/work">{m.portfolio_case_back()}</TextLink>
			</p>
		</aside>
	);
}
