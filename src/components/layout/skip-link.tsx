import { createContext, useContext } from "react";
import { m } from "@/paraglide/messages";

/**
 * Spread on every page's <main> (the shared `Page` does it): the skip link's
 * target. tabIndex -1 lets the link move focus there without adding a tab stop.
 */
export const MAIN_CONTENT = { id: "main-content", tabIndex: -1 } as const;

/**
 * True below a page's <main> (`Page` provides it): a layout that owns the page's
 * <main>, such as a Taskline project around its views, then gets its children's error
 * page as a section instead of a second <main>.
 */
export const InsideMain = createContext(false);
export const useInsideMain = () => useContext(InsideMain);

/**
 * The first tab stop of every page, rendered by the root: jumps past the
 * section's header (and the admin sidebar) to the page's <main>. Hidden until
 * focused. Every section, the portfolio included, targets MAIN_CONTENT.
 */
export function SkipLink() {
	return (
		<a
			href={`#${MAIN_CONTENT.id}`}
			className="sr-only z-50 rounded-md bg-background px-4 py-2 font-medium text-sm shadow-md outline-none ring-[3px] ring-ring/50 focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
			data-testid="skip-link"
		>
			{m.skip_to_content()}
		</a>
	);
}
