import { useSuspenseQuery } from "@tanstack/react-query";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import { formatMonthYear } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { cssVars } from "../../lib/css-vars";
import { aboutQueryOptions, profileQueryOptions } from "../../queries";
import type { Experience } from "../../types";
import { ArchivalFigure } from "../primitives/archival-picture";
import { SectionHeading } from "../primitives/section-heading";
import { ContactSection } from "../sections/contact-section";
import { SkillsSection } from "../sections/skills-section";
import { VoicesSection } from "../sections/voices-section";

/** "2021-04" → "April 2021" in the page's language (noon UTC: the same month in every time zone). */
const monthYear = (value: string) => formatMonthYear(new Date(`${value}-15T12:00:00Z`));

function Period({ entry }: { entry: Experience }) {
	return (
		<p className="text-hm-body text-hm-muted tabular-nums">
			<time dateTime={entry.start}>{monthYear(entry.start)}</time>
			{" – "}
			{entry.end ? <time dateTime={entry.end}>{monthYear(entry.end)}</time> : m.portfolio_about_present()}
		</p>
	);
}

/** /about: who the owner is, what they hold to, where they have worked, what they work with, and what people say. */
export function AboutPage() {
	const { data: profile } = useSuspenseQuery(profileQueryOptions());
	const { data: about } = useSuspenseQuery(aboutQueryOptions());
	const [firstParagraph, ...otherParagraphs] = profile.bio;

	return (
		<>
			<header className="hm-container hm-grid gap-y-12 pt-[clamp(2.5rem,6vw,5rem)] pb-[clamp(4rem,8vw,7rem)]">
				<h1 className="hm-display hm-reveal col-span-4 text-hm-title md:col-span-12">
					{m.portfolio_about_heading({ name: profile.name })}
				</h1>
				<div className="col-span-4 flex flex-col gap-6 md:col-span-6" lang={profile.lang}>
					<p className="font-medium text-hm-lead">{firstParagraph}</p>
					{otherParagraphs.map((paragraph) => (
						<p key={paragraph} className="hm-measure text-hm-body">
							{paragraph}
						</p>
					))}
				</div>
				<div className="col-span-4 md:col-span-5 md:col-start-8">
					{profile.portrait ? (
						<figure className="hm-duotone aspect-[4/5]">
							<CloudImage image={profile.portrait} variant="full" sizes="(min-width: 48rem) 40vw, 100vw" />
						</figure>
					) : (
						<ArchivalFigure picture="kathmandu1920" sizes="(min-width: 48rem) 40vw, 100vw" />
					)}
				</div>
			</header>

			<section aria-labelledby="principles-title" className="hm-field-snow-2 hm-section">
				<div className="hm-container flex flex-col gap-[clamp(3rem,6vw,5rem)]">
					<SectionHeading id="principles-title" title={m.portfolio_about_principles_heading()} />
					<ul className="grid grid-cols-1 gap-x-(--hm-gutter) gap-y-12 md:grid-cols-2 lg:grid-cols-3">
						{profile.principles.map((principle, position) => (
							<li
								key={principle.title}
								lang={principle.lang}
								className="hm-reveal flex flex-col gap-3"
								style={cssVars({ "--hm-i": position % 3 })}
							>
								<h3 className="hm-display text-hm-lead">{principle.title}</h3>
								<p className="text-hm-body">{principle.body}</p>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section aria-labelledby="experience-title" className="hm-section">
				<div className="hm-container flex flex-col gap-[clamp(3rem,6vw,5rem)]">
					<SectionHeading id="experience-title" title={m.portfolio_about_experience_heading()} />
					<ol className="flex flex-col gap-10 md:gap-8">
						{about.experience.map((entry) => (
							<li key={entry.id} lang={entry.lang} className="hm-reveal hm-grid gap-y-2">
								<div className="col-span-4 md:col-span-3">
									<Period entry={entry} />
								</div>
								<div className="col-span-4 md:col-span-4">
									<h3 className="hm-display text-hm-lead">{entry.company}</h3>
									<p className="text-hm-body">{entry.role}</p>
									<p className="text-hm-body text-hm-muted">{entry.location}</p>
								</div>
								<p className="hm-measure col-span-4 text-hm-body md:col-span-5">{entry.summary}</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			<div className="hm-field-ridge">
				<SkillsSection skills={about.skills} toolbox={profile.toolbox} />
			</div>
			<VoicesSection testimonials={about.testimonials} />
			<ContactSection profile={profile} />
		</>
	);
}
