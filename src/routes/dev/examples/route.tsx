import { createFileRoute, Outlet } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/dev/examples")({
	staticData: { breadcrumb: staticCrumb(m.examples_title) },
	component: Outlet,
});
