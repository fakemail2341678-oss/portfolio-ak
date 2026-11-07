import "@tanstack/react-start/server-only";
import type { StackCategory } from "@/features/stack/schema";
import { m } from "@/paraglide/messages";

/**
 * Static reference data for the /stack page. Descriptions are Paraglide
 * messages resolved on the server in the caller's locale (server functions get
 * it from the locale header, see src/middleware/locale.ts).
 */
type StackEntry = { id: string; name: string; category: StackCategory; url: string; describe: () => string };

export const STACK: ReadonlyArray<StackEntry> = [
	{
		id: "tanstack-start",
		name: "TanStack Start",
		category: "framework",
		url: "https://tanstack.com/start",
		describe: m.tool_tanstack_start,
	},
	{
		id: "tanstack-router",
		name: "TanStack Router",
		category: "framework",
		url: "https://tanstack.com/router",
		describe: m.tool_tanstack_router,
	},
	{
		id: "typescript",
		name: "TypeScript",
		category: "quality",
		url: "https://www.typescriptlang.org",
		describe: m.tool_typescript,
	},
	{ id: "vite", name: "Vite", category: "framework", url: "https://vite.dev", describe: m.tool_vite },
	{ id: "tailwind", name: "Tailwind CSS", category: "ui", url: "https://tailwindcss.com", describe: m.tool_tailwind },
	{ id: "shadcn", name: "shadcn/ui", category: "ui", url: "https://ui.shadcn.com", describe: m.tool_shadcn },
	{
		id: "tanstack-query",
		name: "TanStack Query",
		category: "data",
		url: "https://tanstack.com/query",
		describe: m.tool_tanstack_query,
	},
	{
		id: "tanstack-form",
		name: "TanStack Form",
		category: "ui",
		url: "https://tanstack.com/form",
		describe: m.tool_tanstack_form,
	},
	{
		id: "tanstack-db",
		name: "TanStack DB",
		category: "data",
		url: "https://tanstack.com/db",
		describe: m.tool_tanstack_db,
	},
	{
		id: "tanstack-store",
		name: "TanStack Store",
		category: "data",
		url: "https://tanstack.com/store",
		describe: m.tool_tanstack_store,
	},
	{ id: "zod", name: "Zod", category: "quality", url: "https://zod.dev", describe: m.tool_zod },
	{ id: "drizzle", name: "Drizzle ORM", category: "data", url: "https://orm.drizzle.team", describe: m.tool_drizzle },
	{ id: "neon", name: "Neon", category: "data", url: "https://neon.com", describe: m.tool_neon },
	{
		id: "paraglide",
		name: "Paraglide JS",
		category: "i18n",
		url: "https://paraglidejs.com",
		describe: m.tool_paraglide,
	},
	{
		id: "better-auth",
		name: "Better Auth",
		category: "auth",
		url: "https://www.better-auth.com",
		describe: m.tool_better_auth,
	},
	{
		id: "react-email",
		name: "React Email",
		category: "auth",
		url: "https://react.email",
		describe: m.tool_react_email,
	},
	{ id: "resend", name: "Resend", category: "auth", url: "https://resend.com", describe: m.tool_resend },
	{ id: "sentry", name: "Sentry", category: "observability", url: "https://sentry.io", describe: m.tool_sentry },
	{ id: "posthog", name: "PostHog", category: "observability", url: "https://posthog.com", describe: m.tool_posthog },
	{ id: "vitest", name: "Vitest", category: "quality", url: "https://vitest.dev", describe: m.tool_vitest },
	{
		id: "storybook",
		name: "Storybook",
		category: "quality",
		url: "https://storybook.js.org",
		describe: m.tool_storybook,
	},
	{ id: "biome", name: "Biome", category: "quality", url: "https://biomejs.dev", describe: m.tool_biome },
];

export const CATEGORY_LABELS: Readonly<Record<StackCategory, () => string>> = {
	framework: m.category_framework,
	data: m.category_data,
	ui: m.category_ui,
	i18n: m.category_i18n,
	auth: m.category_auth,
	observability: m.category_observability,
	quality: m.category_quality,
};
