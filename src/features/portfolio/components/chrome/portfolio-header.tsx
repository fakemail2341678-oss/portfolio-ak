import { Link } from "@tanstack/react-router";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme";
import { m } from "@/paraglide/messages";
import type { Profile } from "../../types";
import { PORTFOLIO_NAV } from "./nav-items";
import { PortfolioMenu } from "./portfolio-menu";

const navLink =
	"hm-focus py-2 font-medium text-hm-muted transition-colors duration-(--hm-dur-1) hover:text-hm-ink " +
	"decoration-2 underline-offset-[0.6em] data-[status=active]:text-hm-ink data-[status=active]:underline";

/**
 * The portfolio's own bar (each section brings its header, decision 0161): the
 * initials as a wordmark, four plain links, and the language and theme
 * controls the rest of the app uses. Not sticky: the hero's name is the first
 * thing on the page, and nothing ever covers a focused element.
 */
export function PortfolioHeader({ profile }: { profile: Pick<Profile, "name" | "initials"> }) {
	return (
		<header className="hm-container flex h-(--hm-header-h) items-center gap-6">
			{/* The link's name is the visible name (WCAG 2.5.3); on phones it is visually hidden, not removed. */}
			<Link to="/" className="hm-focus flex min-w-0 items-baseline gap-3">
				<span aria-hidden className="font-bold font-hm-display text-[1.75rem] leading-none tracking-[-0.03em]">
					{profile.initials}
				</span>
				<span className="sr-only truncate font-medium sm:not-sr-only">{profile.name}</span>
			</Link>
			<nav aria-label={m.portfolio_nav_label()} className="ml-auto hidden md:block">
				<ul className="flex items-center gap-7">
					{PORTFOLIO_NAV.map((item) => (
						<li key={item.to}>
							<Link to={item.to} className={navLink}>
								{item.label()}
							</Link>
						</li>
					))}
				</ul>
			</nav>
			<div className="hidden items-center gap-1 md:flex">
				<LanguageSwitcher />
				<ThemeToggle />
			</div>
			<PortfolioMenu className="ml-auto md:hidden" />
		</header>
	);
}
