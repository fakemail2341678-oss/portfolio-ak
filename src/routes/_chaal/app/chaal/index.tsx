import { createFileRoute } from "@tanstack/react-router";
import { CHAAL_NAME } from "@/features/chaal/brand";
import { chaalPageHead } from "@/features/chaal/head";
import { ChaalHome } from "@/features/chaal/home/chaal-home";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { m } from "@/paraglide/messages";

/** /app/chaal: Chaal's home, first version (PLAN Task 73). Indexable. The layout's loader read what it shows. */
export const Route = createFileRoute("/_chaal/app/chaal/")({
	head: () => chaalPageHead(CHAAL_PATHS.home, m.ch_home_title(), m.ch_description(), CHAAL_NAME),
	component: ChaalHome,
});
