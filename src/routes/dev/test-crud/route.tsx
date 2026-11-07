import { createFileRoute } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /test-crud/*: names its breadcrumb. No component: renders its child route.
export const Route = createFileRoute("/dev/test-crud")({
	staticData: { breadcrumb: staticCrumb(m.test_crud_public_title) },
});
