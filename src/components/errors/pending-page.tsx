import { type ComponentType, createContext, type ReactNode, useContext } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Spinner } from "@/components/ui/spinner";
import { m } from "@/paraglide/messages";

/**
 * What a section shows while one of its pages loads (decision 0201). A layout that
 * draws its own (the portfolio's printed range) or already renders the page's
 * `<main>` around its outlet says so here, so the router's default pending page
 * fits the frame it appears in.
 */
type SectionPendingValue = {
	/** The section's own pending view, rendered inside its `<main>`. */
	component?: ComponentType;
	/** The layout renders `<main>` around its outlet: don't add another. */
	insideMain?: boolean;
};

const SectionPendingContext = createContext<SectionPendingValue>({});

export function SectionPending({ children, ...value }: SectionPendingValue & { children: ReactNode }) {
	return <SectionPendingContext value={value}>{children}</SectionPendingContext>;
}

/** The status itself: a spinner and "Loading…", read out once (an output is a live region). */
function PendingStatus() {
	return (
		<output className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground text-sm">
			<Spinner aria-hidden className="size-5 text-primary" />
			{m.pending_loading()}
		</output>
	);
}

/**
 * Shown when a route's loader takes longer than the router's pending delay
 * (defaultPendingComponent): the section's own view when it has one.
 */
export function PendingPage() {
	const { component: Section, insideMain } = useContext(SectionPendingContext);
	if (Section) return <Section />;
	if (insideMain) {
		return (
			<div className="w-full py-16" aria-busy="true">
				<PendingStatus />
			</div>
		);
	}
	return (
		<main {...MAIN_CONTENT} className="mx-auto w-full max-w-3xl flex-1 px-4 py-16" aria-busy="true">
			<PendingStatus />
		</main>
	);
}
