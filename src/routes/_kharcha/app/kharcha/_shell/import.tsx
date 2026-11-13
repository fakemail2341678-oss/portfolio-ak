import { createFileRoute } from "@tanstack/react-router";
import { kharchaHead } from "@/features/kharcha/brand";
import { KharchaImportPage } from "@/features/kharcha/spend/import-page";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/kharcha/import (Task 93): a CSV into Spend, previewed line by line before anything is saved. */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/import")({
	loader: async ({ context }) => {
		const { kharchaMeQueryOptions } = await import("@/features/kharcha/queries");
		await ensureQuery(context.queryClient, kharchaMeQueryOptions(context.session.user.id));
	},
	head: () => kharchaHead(m.kharcha_import_title()),
	component: KharchaImportPage,
});
