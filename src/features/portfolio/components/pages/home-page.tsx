import { useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode, Suspense } from "react";
import { homeQueryOptions, profileQueryOptions } from "../../queries";
import { ArchivalFigure } from "../primitives/archival-picture";
import { ContactSection } from "../sections/contact-section";
import { HeroSection } from "../sections/hero-section";
import { ImpactSection } from "../sections/impact-section";
import { IntroSection } from "../sections/intro-section";
import { JournalSection } from "../sections/journal-section";
import { ProcessSection } from "../sections/process-section";
import { SelectedWorkSection } from "../sections/selected-work-section";
import { SkillsSection } from "../sections/skills-section";
import { VoicesSection } from "../sections/voices-section";

/**
 * `/`: who and where (the range at this hour) → what they believe → the work
 * → what they work with → how → what came of it → what people say → writing
 * → write to them. Neighbouring sections never share a field of colour.
 *
 * Each section below the hero is its own Suspense boundary: nothing in them suspends
 * (the page's data is loaded), but React hydrates every boundary as a separate task,
 * so the long page hydrates in short slices instead of one long task (decision 0201).
 */
export function PortfolioHome() {
	const { data: profile } = useSuspenseQuery(profileQueryOptions());
	const { data: home } = useSuspenseQuery(homeQueryOptions());

	return (
		<>
			<HeroSection profile={profile} />
			<Slice>
				<IntroSection profile={profile} />
			</Slice>
			{/* One picture across the page between the beliefs and the work: Sella's panorama of the Kangchen Glacier. */}
			<Slice>
				<div className="hm-field-snow-2 pb-[clamp(3rem,6vw,5rem)]">
					<ArchivalFigure
						picture="kangchenGlacier"
						aspect="2000 / 420"
						phoneAspect="4 / 3"
						position="52% 50%"
						sizes="(min-width: 48rem) 100vw, 200vw"
						className="hm-container"
					/>
				</div>
			</Slice>
			<Slice>
				<SelectedWorkSection projects={home.featured} total={home.projectCount} />
			</Slice>
			<Slice>
				<SkillsSection skills={home.skills} toolbox={profile.toolbox} />
			</Slice>
			<Slice>
				<ProcessSection steps={home.process} />
			</Slice>
			<Slice>
				<ImpactSection metrics={profile.impact} />
			</Slice>
			<Slice>
				<VoicesSection testimonials={home.testimonials} />
			</Slice>
			<Slice>
				<JournalSection posts={home.posts} />
			</Slice>
			<Slice>
				<ContactSection profile={profile} />
			</Slice>
		</>
	);
}

/** A hydration slice: a boundary that never shows its (empty) fallback, since nothing inside suspends. */
function Slice({ children }: { children: ReactNode }) {
	return <Suspense fallback={null}>{children}</Suspense>;
}
