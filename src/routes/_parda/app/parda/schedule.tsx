import { createFileRoute } from "@tanstack/react-router";
import { pardaHead } from "@/features/parda/lib/brand";
import { PardaSchedulePage } from "@/features/parda/schedule/components/schedule-page";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/**
 * /app/parda/schedule: followed series for the next 14 days and anime airing this week,
 * by day (PLAN Task 68, decision 0241). Noindex.
 */
export const Route = createFileRoute("/_parda/app/parda/schedule")({
	loader: async ({ context }) => {
		const { loadSchedulePage } = await import("@/features/parda/schedule/load");
		await loadSchedulePage(context.queryClient, getLocale(), Boolean(context.session));
	},
	head: () => pardaHead(m.parda_schedule_title()),
	component: PardaSchedulePage,
});
