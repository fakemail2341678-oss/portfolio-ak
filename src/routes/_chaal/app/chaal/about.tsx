import { createFileRoute } from "@tanstack/react-router";
import { ChaalAbout } from "@/features/chaal/about/chaal-about";
import { CHAAL_NAME } from "@/features/chaal/brand";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /app/chaal/about: Lichess's attribution, what connecting shares, credits, licences, Stockfish's source. Indexable. */
export const Route = createFileRoute("/_chaal/app/chaal/about")({
	head: () =>
		seo({
			title: m.ch_about_title(),
			siteName: CHAAL_NAME,
			description: m.ch_about_description(),
			path: CHAAL_PATHS.about,
		}),
	component: ChaalAbout,
});
