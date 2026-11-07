import { m } from "@/paraglide/messages";
import { cn } from "../../lib/cn";
import { cssVars } from "../../lib/css-vars";
import type { ProcessStep } from "../../types";
import { ArchivalFigure } from "../primitives/archival-picture";
import { SectionHeading } from "../primitives/section-heading";

/**
 * How a project unfolds, on the pine field: the stages as display lines that
 * switch back and forth across the grid like a trail up a slope, each with
 * what happens and what the client gets. A real ordered list; the order is in
 * the markup, not in printed numbers. Beside the heading, Sella's porters
 * crossing below the Jonsong La.
 */
export function ProcessSection({ steps }: { steps: ReadonlyArray<ProcessStep> }) {
	return (
		<section id="process" aria-labelledby="process-title" className="hm-field-pine hm-section">
			<div className="hm-container hm-grid gap-y-16">
				<SectionHeading
					id="process-title"
					title={m.portfolio_process_heading()}
					intro={m.portfolio_process_intro()}
					className="col-span-4 md:col-span-6 md:self-end"
				/>
				<ArchivalFigure
					picture="jonsongLa"
					sizes="(min-width: 48rem) 45vw, 100vw"
					className="col-span-4 md:col-span-5 md:col-start-8"
				/>
				<ol className="col-span-4 flex flex-col gap-[clamp(4.5rem,9vw,7.5rem)] md:col-span-12">
					{steps.map((step, position) => (
						<li
							key={step.id}
							lang={step.lang}
							className={cn(
								"hm-reveal flex max-w-[44rem] flex-col gap-4",
								// The stages switch back and forth across the page, like a trail up a slope.
								position % 2 === 1 && "md:ms-auto md:text-right md:[&_p]:ms-auto",
							)}
							style={cssVars({ "--hm-i": 0 })}
						>
							<h3 className="hm-display text-hm-head">{step.title}</h3>
							<p className="text-hm-muted text-hm-small">
								<span className="font-semibold">{m.portfolio_process_outputs()}:</span> {step.outputs.join(", ")}
							</p>
							<p className="hm-measure text-hm-body">{step.body}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
