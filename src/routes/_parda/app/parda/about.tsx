import { createFileRoute } from "@tanstack/react-router";
import { PardaAbout } from "@/features/parda/about/parda-about";
import { PARDA_NAME } from "@/features/parda/brand";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /app/parda/about: the notice page (TMDB's attribution, playback, players' ads, takedowns). Indexable. */
export const Route = createFileRoute("/_parda/app/parda/about")({
	head: () =>
		seo({
			title: m.pd_about_title(),
			siteName: PARDA_NAME,
			description: m.pd_about_description(),
			path: "/app/parda/about",
		}),
	component: PardaAbout,
});
