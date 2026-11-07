import { m } from "@/paraglide/messages";
import { cn } from "../../lib/cn";
import { ARCHITECTURE_TIERS } from "../../schema";
import type { CaseStudyBlock } from "../../types";

type ArchitectureBlock = Extract<CaseStudyBlock, { type: "architecture" }>;
type Tier = (typeof ARCHITECTURE_TIERS)[number];

const TIER_LABELS: Record<Tier, () => string> = {
	client: m.portfolio_architecture_client,
	edge: m.portfolio_architecture_edge,
	service: m.portfolio_architecture_service,
	data: m.portfolio_architecture_data,
};

/** Each tier is a band of altitude, from the snow (client, where people are) down to the bedrock (data). */
const STRATA: Record<Tier, string> = {
	client: "bg-(--hm-alt-7)",
	edge: "bg-(--hm-alt-5)",
	service: "bg-(--hm-alt-2)",
	data: "bg-(--hm-alt-0)",
};
const ON_STRATUM: Record<Tier, string> = {
	client: "text-(--hm-on-high)",
	edge: "text-(--hm-on-high)",
	service: "text-(--hm-on-deep)",
	data: "text-(--hm-on-deep)",
};

/**
 * A system diagram in HTML, drawn as a cross-section of the mountain: each
 * tier a stratum, top to bottom, its parts set in it; the data flows below as
 * a real list a screen reader can follow ("Dashboard → Server functions").
 */
export function ArchitectureDiagram({ block }: { block: ArchitectureBlock }) {
	const strata = ARCHITECTURE_TIERS.map((tier) => ({
		tier,
		nodes: block.nodes.filter((node) => node.tier === tier),
	})).filter((stratum) => stratum.nodes.length > 0);
	const labelOf = (id: string) => block.nodes.find((node) => node.id === id)?.label ?? id;

	return (
		<figure lang={block.lang} className="flex flex-col gap-6">
			<div className="flex flex-col">
				{strata.map(({ tier, nodes }) => (
					<div
						key={tier}
						className={cn(
							"grid gap-x-6 gap-y-3 px-5 py-5 md:grid-cols-[9rem_1fr] md:px-7",
							STRATA[tier],
							ON_STRATUM[tier],
						)}
					>
						<p className="font-semibold">{TIER_LABELS[tier]()}</p>
						<ul className="flex flex-wrap gap-x-8 gap-y-3">
							{nodes.map((node) => (
								<li key={node.id} className="flex flex-col">
									<span className="font-semibold">{node.label}</span>
									<span className="text-hm-small">{node.detail}</span>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
			<div>
				<p className="font-semibold">{m.portfolio_architecture_flows()}</p>
				<ul className="mt-2 flex flex-col gap-1 text-hm-body">
					{block.edges.map(({ from, to }) => (
						<li key={`${from}-${to}`}>
							{labelOf(from)} <span aria-hidden>→</span>
							<span className="sr-only">,</span> {labelOf(to)}
						</li>
					))}
				</ul>
			</div>
			{block.caption ? <figcaption className="hm-meta">{block.caption}</figcaption> : null}
		</figure>
	);
}
