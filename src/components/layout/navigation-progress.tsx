import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Loads quicker than this never show the line, so fast pages don't flicker. */
const SHOW_AFTER_MS = 150;
/** How long the finished line stays full before it goes. */
const FINISH_MS = 240;

type Phase = "idle" | "loading" | "done";

/**
 * A thin line across the top of the window while a client-side navigation loads
 * (route loaders, lazy chunks). It grows toward the end, never quite reaching it,
 * then fills and goes when the page is ready. Decorative: the pending page, when
 * a load takes long enough to show one, says it in words. Only transform moves,
 * and under reduced motion the line stands still at a third (decision 0201).
 *
 * Each section's frame mounts it (one header per section, 0161), coloured by its
 * design system: the accent in Graphite, ink in the portfolio.
 */
export function NavigationProgress({ className }: { className?: string }) {
	const loading = useRouterState({ select: (state) => state.isLoading });
	const [phase, setPhase] = useState<Phase>("idle");

	useEffect(() => {
		if (loading) {
			const timer = setTimeout(() => setPhase("loading"), SHOW_AFTER_MS);
			return () => clearTimeout(timer);
		}
		setPhase((current) => (current === "loading" ? "done" : "idle"));
		const timer = setTimeout(() => setPhase("idle"), FINISH_MS);
		return () => clearTimeout(timer);
	}, [loading]);

	if (phase === "idle") return null;
	return (
		<div
			aria-hidden
			data-phase={phase}
			data-testid="navigation-progress"
			className={cn(
				"nav-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary",
				className,
			)}
		/>
	);
}
