import { createFileRoute } from "@tanstack/react-router";
import { KitFieldsExample } from "@/features/dev/examples/kit-fields";
import { staticCrumb } from "@/lib/breadcrumbs";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** The kit's composite form fields in one form (src/features/dev/examples/kit-fields.tsx). */
export const Route = createFileRoute("/dev/examples/fields")({
	staticData: { breadcrumb: staticCrumb(m.examples_fields_title) },
	head: () => privateHead(m.examples_fields_title()),
	component: KitFieldsExample,
});
