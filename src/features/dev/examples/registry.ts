import { m } from "@/paraglide/messages";

/**
 * Every /dev/examples page: one small, real page per module. The index lists
 * these; each page shows its source file and the guide that explains the
 * pattern (and that guide links back here). A test checks this list against
 * the route tree.
 */
export type Example = {
	slug: string;
	title: () => string;
	description: () => string;
	/** The route file: the code to read and copy. */
	source: string;
	guide: string;
};

const route = (file: string) => `src/routes/dev/examples/${file}`;

export const EXAMPLES = [
	{
		slug: "loader-query",
		title: m.examples_loader_title,
		description: m.examples_loader_description,
		source: route("loader-query.tsx"),
		guide: "docs/guides/conventions.md",
	},
	{
		slug: "streaming",
		title: m.examples_streaming_title,
		description: m.examples_streaming_description,
		source: route("streaming.tsx"),
		guide: "docs/guides/conventions.md",
	},
	{
		slug: "filters",
		title: m.examples_filters_title,
		description: m.examples_filters_description,
		source: route("filters.tsx"),
		guide: "docs/guides/search-filters-masking.md",
	},
	{
		slug: "masking",
		title: m.examples_masking_title,
		description: m.examples_masking_description,
		source: route("masking/index.tsx"),
		guide: "docs/guides/search-filters-masking.md",
	},
	{
		slug: "forms",
		title: m.examples_forms_title,
		description: m.examples_forms_description,
		source: route("forms.tsx"),
		guide: "docs/guides/conventions.md",
	},
	{
		slug: "components",
		title: m.examples_components_title,
		description: m.examples_components_description,
		source: "src/features/dev/examples/kit-components.tsx",
		guide: "docs/guides/design-system.md",
	},
	{
		slug: "fields",
		title: m.examples_fields_title,
		description: m.examples_fields_description,
		source: "src/features/dev/examples/kit-fields.tsx",
		guide: "docs/guides/forms.md",
	},
	{
		slug: "data-table",
		title: m.examples_table_title,
		description: m.examples_table_description,
		source: route("data-table.tsx"),
		guide: "docs/guides/conventions.md",
	},
	{
		slug: "optimistic",
		title: m.examples_optimistic_title,
		description: m.examples_optimistic_description,
		source: route("optimistic.tsx"),
		guide: "docs/guides/conventions.md",
	},
	{
		slug: "preferences",
		title: m.examples_preferences_title,
		description: m.examples_preferences_description,
		source: route("preferences.tsx"),
		guide: "docs/guides/conventions.md",
	},
	{
		slug: "permissions",
		title: m.examples_permissions_title,
		description: m.examples_permissions_description,
		source: route("permissions.tsx"),
		guide: "docs/guides/rbac.md",
	},
	{
		slug: "attachments",
		title: m.examples_attachments_title,
		description: m.examples_attachments_description,
		source: route("attachments.tsx"),
		guide: "docs/guides/attachments.md",
	},
	{
		slug: "seo",
		title: m.examples_seo_title,
		description: m.examples_seo_description,
		source: route("seo.tsx"),
		guide: "docs/guides/seo.md",
	},
	{
		slug: "i18n",
		title: m.examples_i18n_title,
		description: m.examples_i18n_description,
		source: route("i18n.tsx"),
		guide: "docs/guides/conventions.md",
	},
	{
		slug: "idempotency",
		title: m.examples_idempotency_title,
		description: m.examples_idempotency_description,
		source: route("idempotency.tsx"),
		guide: "docs/guides/routing-data.md",
	},
	{
		slug: "errors",
		title: m.examples_errors_title,
		description: m.examples_errors_description,
		source: route("errors.tsx"),
		guide: "docs/guides/conventions.md",
	},
	{
		slug: "analytics",
		title: m.examples_analytics_title,
		description: m.examples_analytics_description,
		source: route("analytics.tsx"),
		guide: "README.md",
	},
	{
		slug: "list-extras",
		title: m.examples_extras_title,
		description: m.examples_extras_description,
		source: route("list-extras.tsx"),
		guide: "docs/guides/recipes.md",
	},
	{
		slug: "caching",
		title: m.examples_caching_title,
		description: m.examples_caching_description,
		source: route("caching.tsx"),
		guide: "docs/guides/recipes.md",
	},
	{
		slug: "background-jobs",
		title: m.examples_jobs_title,
		description: m.examples_jobs_description,
		source: route("background-jobs.tsx"),
		guide: "docs/guides/recipes.md",
	},
	{
		slug: "contact",
		title: m.examples_contact_title,
		description: m.examples_contact_description,
		source: route("contact.tsx"),
		guide: "docs/guides/recipes.md",
	},
] as const satisfies ReadonlyArray<Example>;

export type ExampleSlug = (typeof EXAMPLES)[number]["slug"];

export const exampleBySlug = (slug: ExampleSlug): Example => {
	const example = EXAMPLES.find((each) => each.slug === slug);
	if (!example) throw new Error(`Unknown example: ${slug}`);
	return example;
};
