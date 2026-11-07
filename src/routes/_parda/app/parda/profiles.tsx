import { createFileRoute } from "@tanstack/react-router";
import { pardaHead } from "@/features/parda/brand";
import { PardaProfilesPage } from "@/features/parda/profiles/profiles-page";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/** /app/parda/profiles: who's watching, and managing profiles (PLAN Task 67, decision 0240). Noindex. */
export const Route = createFileRoute("/_parda/app/parda/profiles")({
	loader: async ({ context }) => {
		if (!context.session) return;
		const [{ pardaProfilesQueryOptions }, { ensureQuery }] = await Promise.all([
			import("@/features/parda/library/queries"),
			import("@/lib/query"),
		]);
		await ensureQuery(context.queryClient, pardaProfilesQueryOptions(getLocale()));
	},
	head: () => pardaHead(m.pd_profiles_title()),
	component: PardaProfilesPage,
});
