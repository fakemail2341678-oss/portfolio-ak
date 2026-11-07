import { useSuspenseQuery } from "@tanstack/react-query";
import { authFeaturesQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { cssVars } from "../../lib/css-vars";
import { profileQueryOptions } from "../../queries";
import { AvailabilityNote } from "../chrome/availability";
import { HomeTime } from "../chrome/home-time";
import { ContactForm } from "../contact/contact-form";
import { CopyEmailButton } from "../contact/copy-email-button";
import { ArchivalFigure } from "../primitives/archival-picture";
import { FittedEmail } from "../primitives/fitted-email";
import { TextAnchor } from "../primitives/links";

const FIT = [m.portfolio_contact_fit_1, m.portfolio_contact_fit_2, m.portfolio_contact_fit_3] as const;

/** /contact: the address as display type (mailto + copy), when to expect a reply, the form (it reaches the admin inbox) and the map of the valley. */
export function ContactPage() {
	const { data: profile } = useSuspenseQuery(profileQueryOptions());
	const { data: features } = useSuspenseQuery(authFeaturesQueryOptions());
	return (
		<>
			<header className="hm-field-rhodo">
				<div className="hm-container flex flex-col gap-8 pt-[clamp(2.5rem,6vw,5rem)] pb-[clamp(3.5rem,7vw,6rem)]">
					<h1 className="hm-display hm-reveal text-hm-title">{m.portfolio_contact_heading()}</h1>
					<p className="hm-reveal hm-measure text-hm-lead" style={cssVars({ "--hm-i": 1 })}>
						{m.portfolio_contact_intro()}
					</p>
					<div className="hm-reveal @container" style={cssVars({ "--hm-i": 2 })}>
						<a
							href={`mailto:${profile.email}`}
							className="hm-focus block decoration-[0.06em] underline-offset-[0.12em] hover:underline"
						>
							<FittedEmail email={profile.email} />
						</a>
					</div>
					<CopyEmailButton email={profile.email} />
				</div>
			</header>

			<div className="hm-container hm-grid gap-y-16 py-[clamp(4rem,9vw,8rem)]">
				<section
					aria-labelledby="contact-details"
					className="hm-reveal-each col-span-4 flex flex-col gap-10 text-hm-body md:col-span-5"
				>
					<h2 id="contact-details" className="hm-display text-hm-lead">
						{m.portfolio_contact_details()}
					</h2>
					<div className="flex flex-col gap-3 text-hm-body">
						<AvailabilityNote availability={profile.availability} />
						<p>{profile.location}</p>
						<HomeTime generatedAt={profile.generatedAt} location={profile.location} className="text-hm-muted" />
						<p>
							<span className="font-semibold">{m.portfolio_contact_response()}:</span>{" "}
							{m.portfolio_contact_response_time()}
						</p>
					</div>
					<div className="flex flex-col gap-3">
						<h3 className="font-semibold">{m.portfolio_footer_elsewhere()}</h3>
						<ul className="flex flex-col gap-2">
							{profile.socials.map((social) => (
								<li key={social.network}>
									<TextAnchor href={social.href} rel="me noopener">
										{social.network}
									</TextAnchor>{" "}
									<span className="text-hm-muted">{social.handle}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="flex flex-col gap-3">
						<h3 className="font-semibold">{m.portfolio_contact_fit_heading()}</h3>
						<ul className="flex list-disc flex-col gap-2 ps-5 marker:text-hm-muted">
							{FIT.map((item) => (
								<li key={item()}>{item()}</li>
							))}
						</ul>
					</div>
				</section>
				<div className="hm-reveal col-span-4 md:col-span-6 md:col-start-7" style={cssVars({ "--hm-i": 1 })}>
					<ContactForm turnstileSiteKey={features.turnstileSiteKey} />
				</div>
			</div>

			<div className="hm-container pb-[clamp(5rem,10vw,9rem)]">
				<ArchivalFigure picture="valleyMap" aspect="12 / 5" position="45% 48%" sizes="100vw" className="hm-reveal" />
			</div>
		</>
	);
}
