import { Link } from "@tanstack/react-router";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ARCHIVE } from "../../lib/archive";
import type { Profile } from "../../types";
import { FittedName } from "../primitives/fitted-name";
import { TextAnchor } from "../primitives/links";
import { PORTFOLIO_NAV } from "./nav-items";

type FooterProfile = Pick<Profile, "name" | "email" | "location" | "socials" | "since" | "updated">;

const year = (value: number) => formatNumber(value, { useGrouping: false });

/**
 * The close, on the night field: where and how to reach the owner, the
 * sections, elsewhere on the web, the colophon with the archival pictures'
 * credits, and the name once more at full width, cut by the page's last edge.
 */
export function PortfolioFooter({ profile }: { profile: FooterProfile }) {
	const years = `${year(profile.since)}–${year(profile.updated)}`;
	return (
		<footer className="hm-field-night overflow-clip">
			<div className="hm-container hm-grid gap-y-14 pt-[clamp(5rem,9vw,8rem)]">
				<div className="col-span-4 flex flex-col gap-2 text-hm-lead md:col-span-4">
					<p>{profile.location}</p>
					<p>
						<TextAnchor href={`mailto:${profile.email}`} className="[overflow-wrap:anywhere]">
							{profile.email}
						</TextAnchor>
					</p>
				</div>
				<nav aria-label={m.portfolio_footer_navigate()} className="col-span-2 md:col-span-2 md:col-start-6">
					<h2 className="hm-meta mb-4">{m.portfolio_footer_navigate()}</h2>
					<ul className="flex flex-col gap-2">
						<li>
							<Link to="/" className="hm-focus hm-link" activeOptions={{ exact: true }}>
								{m.portfolio_nav_home()}
							</Link>
						</li>
						{PORTFOLIO_NAV.map((item) => (
							<li key={item.to}>
								<Link to={item.to} className="hm-focus hm-link">
									{item.label()}
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<div className="col-span-2 md:col-span-2">
					<h2 className="hm-meta mb-4">{m.portfolio_footer_elsewhere()}</h2>
					<ul className="flex flex-col gap-2">
						{profile.socials.map((social) => (
							<li key={social.network}>
								<TextAnchor href={social.href} rel="me noopener" className="font-normal">
									{social.network}
								</TextAnchor>
							</li>
						))}
					</ul>
				</div>
				<div className="col-span-4 md:col-span-3 md:col-start-10">
					<h2 className="hm-meta mb-4">{m.portfolio_footer_colophon()}</h2>
					<p className="text-hm-small">{m.portfolio_footer_colophon_body()}</p>
					<p className="mt-4 text-hm-small">{m.portfolio_footer_pictures()}</p>
					<ul className="mt-2 flex flex-col gap-1 text-hm-small">
						{Object.values(ARCHIVE).map((picture) => (
							<li key={picture.file}>
								<TextAnchor href={picture.source} rel="noopener" className="font-normal">
									{picture.credit}
								</TextAnchor>
							</li>
						))}
					</ul>
				</div>
				<div className="col-span-4 flex flex-wrap items-center justify-between gap-4 text-hm-small md:col-span-12">
					<p>{m.portfolio_footer_copyright({ years, name: profile.name })}</p>
					<TextAnchor href="#hm-top" className="font-normal">
						{m.portfolio_footer_back_to_top()}
					</TextAnchor>
				</div>
			</div>
			<div aria-hidden className="hm-container @container mt-[clamp(3rem,6vw,5rem)] select-none">
				<FittedName name={profile.name} className="-mb-[0.2em]" />
			</div>
		</footer>
	);
}
