import { m } from "@/paraglide/messages";
import type { Profile } from "../../types";
import { AvailabilityNote } from "../chrome/availability";
import { HomeTime } from "../chrome/home-time";
import { ArchivalFigure } from "../primitives/archival-picture";
import { FittedEmail } from "../primitives/fitted-email";
import { TextAnchor, TextLink } from "../primitives/links";

type ContactProfile = Pick<Profile, "email" | "availability" | "generatedAt" | "location" | "resume">;

/**
 * The close of the home page, on the rhododendron field: the invitation, the
 * email address set as display type (a mailto link), when to expect a reply,
 * and the 1928 map of the valley the owner works from.
 */
export function ContactSection({ profile }: { profile: ContactProfile }) {
	return (
		<section id="contact" aria-labelledby="contact-title" className="hm-field-rhodo hm-section">
			<div className="hm-container hm-grid gap-y-14">
				<h2 id="contact-title" className="hm-display hm-reveal col-span-4 text-hm-head md:col-span-9">
					{m.portfolio_finale_heading()}
				</h2>
				<div className="@container col-span-4 md:col-span-12">
					<a
						href={`mailto:${profile.email}`}
						className="hm-focus block decoration-[0.06em] underline-offset-[0.12em] hover:underline"
					>
						<FittedEmail email={profile.email} />
					</a>
				</div>
				<div className="col-span-4 flex flex-col gap-4 text-hm-body md:col-span-6">
					<AvailabilityNote availability={profile.availability} />
					<HomeTime generatedAt={profile.generatedAt} location={profile.location} />
					<p className="flex flex-wrap gap-x-7 gap-y-3 pt-2 text-hm-lead">
						<TextLink to="/contact">{m.portfolio_finale_cta()}</TextLink>
						{profile.resume ? (
							<TextAnchor href={profile.resume} type="application/pdf">
								{m.portfolio_hero_resume()}
							</TextAnchor>
						) : null}
					</p>
				</div>
				<ArchivalFigure
					picture="valleyMap"
					aspect="6 / 5"
					position="45% 45%"
					sizes="(min-width: 48rem) 40vw, 100vw"
					className="col-span-4 md:col-span-5 md:col-start-8"
				/>
			</div>
		</section>
	);
}
