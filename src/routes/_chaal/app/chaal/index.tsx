import { createFileRoute } from "@tanstack/react-router";
import { ChaalHome } from "@/features/chaal/home/chaal-home";
import { chaalHomeHead } from "@/features/chaal/home/head";

/** /app/chaal: Chaal's home, first version (PLAN Task 73). Indexable. The layout's loader read what it shows. */
export const Route = createFileRoute("/_chaal/app/chaal/")({
	head: () => chaalHomeHead(),
	component: ChaalHome,
});
