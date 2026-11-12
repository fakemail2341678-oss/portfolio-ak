import { createFileRoute } from "@tanstack/react-router";
import { kharchaHead } from "@/features/kharcha/brand";
import { KharchaHome } from "@/features/kharcha/home/kharcha-home";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/kharcha/home: the caller's to-dos, totals, this month against last and recent activity. */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/home")({
	loader: async ({ context }) => {
		const { kharchaHomeQueryOptions } = await import("@/features/kharcha/queries");
		await ensureQuery(context.queryClient, kharchaHomeQueryOptions(context.session.user.id));
	},
	head: () => kharchaHead(m.kharcha_nav_home()),
	component: KharchaHome,
});
