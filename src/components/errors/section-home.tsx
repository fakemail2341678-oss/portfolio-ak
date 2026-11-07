import { createContext, type ReactElement, type ReactNode, useContext } from "react";

/**
 * Where a section's error and not-found pages send people "home": the site's home
 * page by default, a section's own start page when it is a product of its own
 * (Taskline's Home, decision 0208). The value is the link element itself (a
 * `<Link>` with its label), rendered inside the page's outline button.
 */
const SectionHomeContext = createContext<ReactElement | null>(null);

/** @public What a section of its own wraps its frame in (with none, the error pages link home). */
export function SectionHome({ link, children }: { link: ReactElement; children: ReactNode }) {
	return <SectionHomeContext value={link}>{children}</SectionHomeContext>;
}

/** The section's home link, or null for the site's own. */
export const useSectionHome = () => useContext(SectionHomeContext);
