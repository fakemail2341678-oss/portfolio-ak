import { createFileRoute } from "@tanstack/react-router";
import { HabitsHome } from "@/features/apps/habits/components/habits-home";
import { habitsSearchSchema } from "@/features/apps/habits/search";
import { listSearch } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/habits: the landing for visitors (indexable), the user's habits once they have a session. */
export const Route = createFileRoute("/_apps/apps/habits/")({
	...listSearch(habitsSearchSchema, habitsSearchSchema.parse({})),
	loader: async ({ context }) => {
		if (!context.session) return;
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { habitsOverviewQueryOptions } = await import("@/features/apps/habits/queries");
		await ensureQuery(context.queryClient, habitsOverviewQueryOptions(context.session.user.id));
	},
	head: () => seo({ title: m.habits_name(), description: m.habits_seo_description(), path: "/apps/habits" }),
	component: HabitsHome,
});
