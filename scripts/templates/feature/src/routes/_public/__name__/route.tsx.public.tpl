import { createFileRoute } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /__name__/*: names its breadcrumb. Renders its child route.
export const Route = createFileRoute("/_public/__name__")({
	staticData: { breadcrumb: staticCrumb(m.__snake___public_title) },
});
