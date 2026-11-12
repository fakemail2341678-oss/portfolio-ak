import { createFileRoute } from "@tanstack/react-router";
import { KHARCHA_BRAND, kharchaTitle } from "@/features/kharcha/brand";
import { kharchaFontPreloads } from "@/features/kharcha/lib/fonts";
import { KharchaPublicNotFound, KharchaSection } from "@/features/kharcha/shell/section";
import { NOINDEX } from "@/lib/seo";
import { getLocale } from "@/paraglide/runtime";

/**
 * Kharcha at /app/kharcha (docs/guides/kharcha.md, decisions 0277 and 0282): a product of
 * its own. Its brand ("Bahi Khata" on <html>, its icons and manifest), its title suffix,
 * its fonts, and noindex for every page but the landing (whose seo() overrides it). Its
 * frames are the children's: the public one (landing, sign-in, sign-up) and the
 * signed-in shell (`_shell`).
 */
export const Route = createFileRoute("/_kharcha")({
	staticData: { brand: KHARCHA_BRAND },
	head: () => ({ meta: [{ title: kharchaTitle() }, NOINDEX], links: kharchaFontPreloads(getLocale()) }),
	// A layout's notFoundComponent replaces the layout, so it brings the frame itself.
	notFoundComponent: KharchaPublicNotFound,
	component: KharchaSection,
});
