import { createFileRoute, Outlet } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/dev/examples/masking")({
	staticData: { breadcrumb: staticCrumb(m.examples_masking_title) },
	component: Outlet,
});
