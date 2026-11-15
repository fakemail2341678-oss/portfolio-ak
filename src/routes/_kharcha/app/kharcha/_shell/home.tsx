import { createFileRoute } from "@tanstack/react-router";
import { KharchaHome } from "@/features/kharcha/home/components/kharcha-home-page";
import { kharchaHead } from "@/features/kharcha/lib/brand";
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
