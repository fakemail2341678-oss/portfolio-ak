import { Link } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { lazy, type MouseEvent, Suspense, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { useHotkeyLabel, useHotkeys } from "@/hooks/use-hotkeys";
import { m } from "@/paraglide/messages";
import { pardaLinks } from "../links";

const SearchOverlay = lazy(() => import("./search-overlay"));

/**
 * The top mask's Search (Task 66): a link to the search page, so it works without
 * JavaScript; with it, a click, Ctrl/⌘ K or `/` opens the overlay instead, loaded on
 * first use. A click with a modifier still opens the page (a new tab, a window).
 */
export function PardaSearchButton({ className }: { className?: string }) {
	const [open, setOpen] = useState(false);
	const [used, setUsed] = useState(false);
	const show = () => {
		setUsed(true);
		setOpen(true);
	};
	useHotkeys({ "mod+k": show, "/": show });
	const shortcut = useHotkeyLabel("mod+k");
	const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		show();
	};
	return (
		<>
			<Link
				{...pardaLinks.search()}
				onClick={onClick}
				aria-keyshortcuts="Control+K Meta+K /"
				className={`flex h-9 items-center gap-2 px-2 text-pd-muted text-sm outline-none transition-colors hover:text-pd-ink focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:min-w-44 lg:bg-pd-ground-2 lg:px-3 ${className ?? ""}`}
				data-testid="parda-search-button"
			>
				<SearchIcon aria-hidden className="size-4.5 shrink-0" />
				<span className="max-lg:sr-only">{m.pd_nav_search()}</span>
				<Kbd className="ms-auto min-w-12 justify-center max-lg:hidden">{shortcut}</Kbd>
			</Link>
			{used ? (
				<Suspense fallback={null}>
					<SearchOverlay open={open} onOpenChange={setOpen} />
				</Suspense>
			) : null}
		</>
	);
}
