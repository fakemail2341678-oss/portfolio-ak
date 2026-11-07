import { createFileRoute } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /admin/*: names the first breadcrumb. No component: renders its child route.
export const Route = createFileRoute("/_admin/admin")({
	staticData: { breadcrumb: staticCrumb(m.admin_title) },
});
