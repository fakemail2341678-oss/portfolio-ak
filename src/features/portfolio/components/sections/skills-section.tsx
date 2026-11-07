import { m } from "@/paraglide/messages";
import { cssVars } from "../../lib/css-vars";
import type { Skill } from "../../types";
import { SectionHeading } from "../primitives/section-heading";

type SkillsSectionProps = {
	skills: ReadonlyArray<Skill>;
	toolbox: ReadonlyArray<string>;
};

/**
 * What the owner works with, as columns of names at one size: each area of
 * practice in full ink, what it covers under it, and the daily toolbox as the
 * last column.
 */
export function SkillsSection({ skills, toolbox }: SkillsSectionProps) {
	return (
		<section id="skills" aria-labelledby="skills-title" className="hm-section">
			<div className="hm-container flex flex-col gap-[clamp(3rem,6vw,5rem)]">
				<SectionHeading id="skills-title" title={m.portfolio_capabilities_heading()} />
				<ul className="grid grid-cols-1 gap-x-(--hm-gutter) gap-y-12 sm:grid-cols-2 lg:grid-cols-5">
					{skills.map((skill, position) => (
						<li
							key={skill.id}
							lang={skill.lang}
							className="hm-reveal flex flex-col gap-3"
							style={cssVars({ "--hm-i": position })}
						>
							<h3 className="font-semibold text-hm-body">{skill.title}</h3>
							<p className="text-hm-muted text-hm-small">{skill.summary}</p>
							<ul aria-label={skill.title} className="flex flex-col gap-1 pt-2 text-hm-body">
								{skill.skills.map((name) => (
									<li key={name}>{name}</li>
								))}
							</ul>
						</li>
					))}
					<li className="hm-reveal flex flex-col gap-3" style={cssVars({ "--hm-i": skills.length })}>
						<h3 className="font-semibold text-hm-body">{m.portfolio_capabilities_toolbox()}</h3>
						<ul aria-label={m.portfolio_capabilities_toolbox()} className="flex flex-col gap-1 pt-2 text-hm-body">
							{toolbox.map((tool) => (
								<li key={tool}>{tool}</li>
							))}
						</ul>
					</li>
				</ul>
			</div>
		</section>
	);
}
