import { createFileRoute } from "@tanstack/react-router";
import { PARDA_BRAND, pardaTitle } from "@/features/parda/brand";
import { pardaFontPreloads } from "@/features/parda/lib/fonts";
import { PardaNotFound, PardaSection } from "@/features/parda/shell/section";
import { NOINDEX } from "@/lib/seo";
import { getLocale } from "@/paraglide/runtime";

/**
 * Parda at /app/parda (docs/guides/parda.md, decisions 0228 and 0232): a product of its
 * own. Its brand ("Masking" on <html>, dark by default, its icons and manifest), its
 * title suffix, its fonts, and noindex for every page that doesn't say otherwise
 * with seo(). Every page is in its frame; a 404 brings the frame itself.
 */
export const Route = createFileRoute("/_parda")({
	staticData: { brand: PARDA_BRAND },
	// The admin's banner (decision 0237) and a guest's, which names the day their progress is
	// deleted (decision 0236): read here, so both render whole. None of these can fail the page.
	loader: async ({ context }) => {
		const [{ pardaBannerQueryOptions }, { ensureQuery }] = await Promise.all([
			import("@/features/parda/queries"),
			import("@/lib/query"),
		]);
		// A session's profile (the account menu), what it saved (every My List and ♥ button, decision 0240)
		// and its alerts (the bell, decision 0241).
		const viewer = async () => {
			if (!context.session) return;
			const [{ pardaSavedQueryOptions, pardaViewerQueryOptions }, { pardaInboxQueryOptions }] = await Promise.all([
				import("@/features/parda/library/queries"),
				import("@/features/parda/schedule/queries"),
			]);
			await Promise.all([
				ensureQuery(context.queryClient, pardaViewerQueryOptions()).catch(() => undefined),
				ensureQuery(context.queryClient, pardaSavedQueryOptions()).catch(() => undefined),
				ensureQuery(context.queryClient, pardaInboxQueryOptions(getLocale())).catch(() => undefined),
			]);
		};
		await Promise.all([ensureQuery(context.queryClient, pardaBannerQueryOptions()).catch(() => undefined), viewer()]);
	},
	head: () => ({ meta: [{ title: pardaTitle() }, NOINDEX], links: pardaFontPreloads(getLocale()) }),
	notFoundComponent: PardaNotFound,
	component: PardaSection,
});
