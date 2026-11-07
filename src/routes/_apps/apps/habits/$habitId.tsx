import { createFileRoute, redirect } from "@tanstack/react-router";
import { HabitPage } from "@/features/apps/habits/components/habit-page";
import { habitParamsSchema } from "@/features/apps/habits/search";
import { loadDetailOr404 } from "@/lib/crud/route";
import { parseParams } from "@/lib/list/params";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /apps/habits/$habitId: one of the user's habits, its streaks and year (private; someone else's is a 404). */
export const Route = createFileRoute("/_apps/apps/habits/$habitId")({
	// Only UUIDs match; anything else is the localized 404 without a round trip.
	params: { parse: (raw) => parseParams(habitParamsSchema, raw) },
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/apps/habits" });
		return { session: context.session };
	},
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { habitQueryOptions } = await import("@/features/apps/habits/queries");
		const detail = await loadDetailOr404(
			context.queryClient,
			habitQueryOptions(context.session.user.id, params.habitId),
		);
		return { title: detail.habit.name };
	},
	head: ({ loaderData }) => privateHead(loaderData?.title ?? m.habits_name()),
	component: HabitPage,
});
