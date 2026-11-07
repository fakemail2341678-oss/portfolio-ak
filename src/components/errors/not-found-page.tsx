import { Link } from "@tanstack/react-router";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { useSectionHome } from "./section-home";

/** The router's 404 (`notFoundComponent`, so it takes no props of its own). */
export function NotFoundPage() {
	return <NotFound />;
}

/** The 404's content; `titleClassName` sets a section's own heading type (Parda's display face). */
export function NotFound({ titleClassName }: { titleClassName?: string }) {
	const home = useSectionHome();
	return (
		<main
			{...MAIN_CONTENT}
			className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-16"
			data-testid="not-found-page"
		>
			<h1 className={titleClassName ?? "font-semibold text-2xl tracking-tight"}>{m.not_found_title()}</h1>
			<p className="text-muted-foreground">{m.not_found_description()}</p>
			<Button asChild variant="outline">
				{home ?? <Link to="/">{m.error_go_home()}</Link>}
			</Button>
		</main>
	);
}
