import { createFileRoute } from "@tanstack/react-router";
import { CHAAL_BRAND, chaalTitle } from "@/features/chaal/brand";
import { chaalFontPreloads } from "@/features/chaal/lib/fonts";
import { ChaalNotFound, ChaalSection } from "@/features/chaal/shell/section";
import { NOINDEX } from "@/lib/seo";
import { getLocale } from "@/paraglide/runtime";

/**
 * Chaal at /app/chaal (docs/guides/chaal.md, decisions 0254, 0258 and 0259): a product of
 * its own. Its brand ("Diagram" on <html>, following the device for light and dark, its
 * icons and manifest), its title suffix, its fonts, and noindex for every page that doesn't
 * say otherwise with seo(). Every page is in its frame; a 404 brings the frame itself.
 */
export const Route = createFileRoute("/_chaal")({
	staticData: { brand: CHAAL_BRAND },
	// The status (switches, whether this visitor may connect, the admin's notice) for every page;
	// for a session its Lichess connection (the account button's dot) and preferences (the board's
	// theme), so the first paint is whole. None of these can fail the page.
	loader: async ({ context }) => {
		const [{ chaalConnectionQueryOptions, chaalStatusQueryOptions }, { ensureQuery }] = await Promise.all([
			import("@/features/chaal/queries"),
			import("@/lib/query"),
		]);
		const personal = async () => {
			if (!context.session) return;
			const { chaalPreferencesQueryOptions } = await import("@/features/chaal/settings/queries");
			await Promise.all([
				ensureQuery(context.queryClient, chaalConnectionQueryOptions()).catch(() => undefined),
				ensureQuery(context.queryClient, chaalPreferencesQueryOptions()).catch(() => undefined),
			]);
		};
		await Promise.all([ensureQuery(context.queryClient, chaalStatusQueryOptions()).catch(() => undefined), personal()]);
	},
	head: () => ({ meta: [{ title: chaalTitle() }, NOINDEX], links: chaalFontPreloads(getLocale()) }),
	notFoundComponent: ChaalNotFound,
	component: ChaalSection,
});
