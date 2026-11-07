import { createFileRoute } from "@tanstack/react-router";
import { TASKLINE_BRAND, tasklineTitle } from "@/features/taskline/brand";
import { TasklinePublicNotFound, TasklineSection } from "@/features/taskline/shell/section";
import { fontPreloads } from "@/lib/fonts";
import { NOINDEX } from "@/lib/seo";
import { getLocale } from "@/paraglide/runtime";

/**
 * Taskline at /app/taskline (docs/guides/taskline.md, decision 0208): a product of its
 * own inside the app. Its brand (the accent on <html>, its icons and manifest), its
 * title suffix, and noindex for every page but the landing (whose seo() overrides it).
 * Its frames are the children's: the public one (landing, sign-in, sign-up) and the
 * signed-in shell (`_shell`).
 */
export const Route = createFileRoute("/_taskline")({
	staticData: { brand: TASKLINE_BRAND },
	head: () => ({ meta: [{ title: tasklineTitle() }, NOINDEX], links: fontPreloads(getLocale()) }),
	// A layout's notFoundComponent replaces the layout, so it brings the frame itself.
	notFoundComponent: TasklinePublicNotFound,
	component: TasklineSection,
});
