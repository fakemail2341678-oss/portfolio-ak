import { createFileRoute } from "@tanstack/react-router";
import { AppsGallery } from "@/features/apps/components/apps-gallery";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps: the showcase apps (decision 0187). */
export const Route = createFileRoute("/_apps/apps/")({
	head: () => seo({ title: m.apps_title(), description: m.apps_description(), path: "/apps" }),
	component: AppsGallery,
});
