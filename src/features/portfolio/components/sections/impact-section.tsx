import { m } from "@/paraglide/messages";
import type { Metric } from "../../types";
import { ArchivalFigure } from "../primitives/archival-picture";
import { FigureLines } from "../primitives/figure-lines";
import { SectionHeading } from "../primitives/section-heading";

/** A decade in numbers, stated quietly, beside Kangchenjunga at first light. */
export function ImpactSection({ metrics }: { metrics: ReadonlyArray<Metric> }) {
	return (
		<section id="impact" aria-labelledby="impact-title" className="hm-field-snow-2 hm-section">
			<div className="hm-container hm-grid items-center gap-y-14">
				<div className="col-span-4 flex flex-col gap-12 md:col-span-6">
					<SectionHeading id="impact-title" title={m.portfolio_impact_heading()} />
					<FigureLines metrics={metrics} />
				</div>
				<ArchivalFigure
					picture="kangchenjungaDawn"
					aspect="4 / 5"
					position="55% 40%"
					sizes="(min-width: 48rem) 40vw, 100vw"
					className="col-span-4 md:col-span-5 md:col-start-8"
				/>
			</div>
		</section>
	);
}
