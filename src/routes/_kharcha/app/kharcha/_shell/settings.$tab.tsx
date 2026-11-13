import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { kharchaHead } from "@/features/kharcha/brand";
import { SETTINGS_TABS } from "@/features/kharcha/search";
import { SettingsPage } from "@/features/kharcha/settings/settings-page";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/kharcha/settings/$tab: the caller's own lists, a tab each (Task 89), and their recurring expenses (Task 94); an unknown tab is a 404. */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/settings/$tab")({
	params: { parse: (raw) => parseParams(z.object({ tab: z.enum(SETTINGS_TABS) }), raw) },
	loader: async ({ context, params }) => {
		const { kharchaListsQueryOptions, kharchaMeQueryOptions, kharchaRecurringQueryOptions } = await import(
			"@/features/kharcha/queries"
		);
		const userId = context.session.user.id;
		await Promise.all([
			ensureQuery(context.queryClient, kharchaListsQueryOptions(userId)),
			params.tab === "recurring"
				? Promise.all([
						ensureQuery(context.queryClient, kharchaRecurringQueryOptions(userId)),
						ensureQuery(context.queryClient, kharchaMeQueryOptions(userId)),
					])
				: undefined,
		]);
	},
	head: () => kharchaHead(m.kharcha_nav_settings()),
	component: SettingsPage,
});
