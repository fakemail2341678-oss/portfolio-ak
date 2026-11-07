import { m } from "@/paraglide/messages";
import { cn } from "../../lib/cn";
import type { Testimonial } from "../../types";

function Attribution({ testimonial }: { testimonial: Testimonial }) {
	return (
		<figcaption className="mt-5 flex flex-col">
			<span className="font-semibold">{testimonial.name}</span>
			<span className="text-hm-muted">
				{testimonial.role}, {testimonial.company}
			</span>
		</figcaption>
	);
}

/**
 * What people say, on the night field: one voice set large in the upper part,
 * up to two quieter ones in the lower corners. One or two testimonials lay
 * out as well as three.
 */
export function VoicesSection({ testimonials }: { testimonials: ReadonlyArray<Testimonial> }) {
	const [lead, ...rest] = testimonials;
	if (!lead) return null;
	const corners = rest.slice(0, 2);
	return (
		<section id="voices" aria-labelledby="voices-title" className="hm-field-night hm-section">
			<div className="hm-container flex flex-col gap-y-[clamp(3rem,7vw,6rem)]">
				<h2 id="voices-title" className="hm-display text-hm-lead">
					{m.portfolio_voices_heading()}
				</h2>
				<figure lang={lead.lang} className="hm-reveal max-w-[54rem]">
					<blockquote className="hm-statement text-hm-lead">
						<p>“{lead.quote}”</p>
					</blockquote>
					<Attribution testimonial={lead} />
				</figure>
				{corners.length > 0 ? (
					<ul className="grid grid-cols-1 gap-x-(--hm-gutter) gap-y-12 md:grid-cols-12">
						{corners.map((testimonial, position) => (
							<li
								key={testimonial.id}
								lang={testimonial.lang}
								className={cn("hm-reveal md:col-span-4", position === 1 && "md:col-start-9")}
							>
								<figure>
									<blockquote className="text-hm-body">
										<p>“{testimonial.quote}”</p>
									</blockquote>
									<Attribution testimonial={testimonial} />
								</figure>
							</li>
						))}
					</ul>
				) : null}
			</div>
		</section>
	);
}
