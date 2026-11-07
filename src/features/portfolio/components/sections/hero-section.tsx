import { useMinuteClock } from "@/hooks/use-minute-clock";
import { m } from "@/paraglide/messages";
import { skyAt } from "../../lib/daylight";
import type { Profile } from "../../types";
import { HeroRange } from "../art/hero-range";
import { AvailabilityNote } from "../chrome/availability";
import { HomeTime } from "../chrome/home-time";
import { FittedName } from "../primitives/fitted-name";
import { ButtonLink, TextAnchor, TextLink } from "../primitives/links";

type HeroProfile = Pick<
	Profile,
	"name" | "initials" | "role" | "location" | "availability" | "resume" | "generatedAt" | "lang"
>;

/**
 * The first screen: the range under Kathmandu's sky at this hour, then the
 * owner's name set as a monument, one sentence saying who and where, the
 * availability, the live time, and the one action. The sky and the time are
 * drawn for the moment the server read the page and follow the clock after
 * hydration (decision 0182).
 */
export function HeroSection({ profile }: { profile: HeroProfile }) {
	const now = useMinuteClock(Date.parse(profile.generatedAt));
	return (
		<section aria-labelledby="hero-title" className="relative">
			{/*
			 * The range takes what the first screen leaves after the header, the fitted
			 * name (about 13vw tall) and the text under it, up to 56% of the screen, so
			 * "Get in touch" stays on the first screen of a laptop.
			 */}
			<HeroRange
				seed={profile.initials}
				sky={skyAt(now)}
				className="h-[clamp(12rem,34svh,20rem)] md:h-[clamp(17rem,min(56svh,calc(100svh_-_18rem_-_13vw)),40rem)]"
			/>
			<div className="hm-container pt-[clamp(1.25rem,2.5vw,2.25rem)] pb-[clamp(3rem,6vw,5rem)]" lang={profile.lang}>
				<div className="@container">
					<FittedName as="h1" id="hero-title" name={profile.name} animate />
				</div>
				<div className="hm-grid mt-[clamp(1.25rem,2.5vw,2rem)] items-end gap-y-8">
					<div className="col-span-4 flex flex-col gap-3 md:col-span-7">
						<p className="font-medium text-hm-lead">
							{m.portfolio_hero_sentence({ role: profile.role, place: profile.location })}
						</p>
						<AvailabilityNote availability={profile.availability} className="text-hm-body" />
						<HomeTime generatedAt={profile.generatedAt} location={profile.location} className="text-hm-muted" />
					</div>
					<div className="col-span-4 flex flex-wrap items-center gap-x-7 gap-y-4 md:col-span-5 md:justify-end">
						<ButtonLink to="/contact">{m.portfolio_hero_contact()}</ButtonLink>
						{profile.resume ? (
							<TextAnchor href={profile.resume} type="application/pdf">
								{m.portfolio_hero_resume()}
							</TextAnchor>
						) : null}
						<TextLink to="/work">{m.portfolio_hero_cta_work()}</TextLink>
					</div>
				</div>
			</div>
		</section>
	);
}
