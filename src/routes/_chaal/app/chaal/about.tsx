import { createFileRoute } from "@tanstack/react-router";
import { ChaalAbout } from "@/features/chaal/about/components/chaal-about-page";
import { CHAAL_NAME } from "@/features/chaal/lib/brand";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /app/chaal/about: Lichess's attribution, what connecting shares, credits, licences, Stockfish's source. Indexable. */
export const Route = createFileRoute("/_chaal/app/chaal/about")({
	head: () =>
		seo({
			title: m.chaal_about_title(),
			siteName: CHAAL_NAME,
			description: m.chaal_about_description(),
			path: CHAAL_PATHS.about,
		}),
	component: ChaalAbout,
});
