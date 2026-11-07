import { createFileRoute } from "@tanstack/react-router";
import { AppearanceSettings } from "@/features/admin/components/appearance-settings";
import { staticCrumb } from "@/lib/breadcrumbs";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

// Personal settings (cookies in this browser): any admin-area user may open it, no permission.
export const Route = createFileRoute("/_admin/admin/settings/appearance")({
	staticData: { breadcrumb: staticCrumb(m.admin_nav_appearance) },
	head: () => privateHead(m.admin_nav_appearance()),
	component: AppearanceSettings,
});
