import { m } from "@/paraglide/messages";

/** The portfolio's main sections, in navigation order. Labels are messages, called at render time. */
export const PORTFOLIO_NAV = [
	{ to: "/work", label: m.portfolio_nav_work },
	{ to: "/about", label: m.portfolio_nav_about },
	{ to: "/journal", label: m.portfolio_nav_journal },
	{ to: "/contact", label: m.portfolio_nav_contact },
] as const;
