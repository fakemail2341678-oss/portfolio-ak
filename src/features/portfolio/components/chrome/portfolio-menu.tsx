import { Link } from "@tanstack/react-router";
import { type KeyboardEvent, useRef } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme";
import { m } from "@/paraglide/messages";
import { cn } from "../../lib/cn";
import { PORTFOLIO_NAV } from "./nav-items";

/**
 * The phone menu: a native <details> disclosure, so it opens and closes before
 * JavaScript loads. Once hydrated, choosing a link or pressing Escape closes it.
 */
export function PortfolioMenu({ className }: { className?: string | undefined }) {
	const details = useRef<HTMLDetailsElement>(null);
	const close = () => {
		if (details.current) details.current.open = false;
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Escape" || !details.current?.open) return;
		close();
		details.current.querySelector("summary")?.focus();
	};

	return (
		<details ref={details} className={cn("group", className)} onKeyDown={onKeyDown}>
			<summary className="hm-focus flex min-h-11 cursor-pointer list-none items-center bg-hm-ground-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
				<span className="group-open:hidden">{m.portfolio_menu_open()}</span>
				<span className="hidden group-open:inline">{m.portfolio_menu_close()}</span>
			</summary>
			<div className="hm-canvas fixed inset-x-0 top-(--hm-header-h) bottom-0 z-40 hidden flex-col overflow-y-auto group-open:flex">
				<nav aria-label={m.portfolio_nav_label()} className="hm-container flex-1 py-8">
					<ul className="flex flex-col gap-1">
						{PORTFOLIO_NAV.map((item) => (
							<li key={item.to}>
								<Link
									to={item.to}
									onClick={close}
									className="hm-focus hm-display block py-2 text-hm-head decoration-[0.06em] underline-offset-[0.15em] data-[status=active]:underline"
								>
									{item.label()}
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<div className="hm-container flex items-center justify-between gap-4 bg-hm-ground-2 py-5">
					<LanguageSwitcher />
					<ThemeToggle />
				</div>
			</div>
		</details>
	);
}
