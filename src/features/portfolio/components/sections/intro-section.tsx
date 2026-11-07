import { m } from "@/paraglide/messages";
import { cssVars } from "../../lib/css-vars";
import type { Profile } from "../../types";

type IntroProfile = Pick<Profile, "headline" | "intro" | "manifesto" | "principles" | "lang">;

/**
 * What the owner believes: the profile's headline lines as one statement, the
 * intro and the manifesto in a reading column, and the principles beside them.
 */
export function IntroSection({ profile }: { profile: IntroProfile }) {
	return (
		<section id="intro" aria-labelledby="intro-title" className="hm-field-snow-2 hm-section">
			<div className="hm-container hm-grid gap-y-16" lang={profile.lang}>
				<div className="col-span-4 flex flex-col gap-8 md:col-span-12 lg:col-span-7">
					<h2 id="intro-title" className="hm-display hm-reveal text-hm-head">
						{profile.headline.join(" ")}
					</h2>
					<p className="hm-reveal hm-measure font-medium text-hm-lead" style={cssVars({ "--hm-i": 1 })}>
						{profile.intro}
					</p>
					<p className="hm-reveal hm-measure text-hm-body" style={cssVars({ "--hm-i": 2 })}>
						{profile.manifesto}
					</p>
				</div>
				<div className="col-span-4 md:col-span-8 lg:col-span-4 lg:col-start-9 lg:pt-3">
					<h3 className="hm-display text-hm-lead">{m.portfolio_about_principles()}</h3>
					<ul className="mt-7 flex flex-col gap-7">
						{profile.principles.map((principle, position) => (
							<li
								key={principle.title}
								lang={principle.lang}
								className="hm-reveal flex flex-col gap-1.5"
								style={cssVars({ "--hm-i": position })}
							>
								<p className="font-semibold text-hm-body">{principle.title}</p>
								<p className="text-hm-body text-hm-muted">{principle.body}</p>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
