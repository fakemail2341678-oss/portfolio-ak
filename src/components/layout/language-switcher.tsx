import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale, type Locale, locales, localizeHref } from "@/paraglide/runtime";

const languageNames: Record<Locale, () => string> = {
	en: m.language_en,
	ne: m.language_ne,
};

/**
 * Links to the current page in each locale, keeping path, search params and hash.
 *
 * Plain <a> elements (not router <Link>) on purpose: switching locale needs a
 * full document load so SSR renders the new language, <html lang> and fonts.
 * This also works with JavaScript disabled and is crawlable.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
	// The router location is already de-localized by the rewrite in router.tsx.
	const href = useRouterState({ select: (state) => state.location.href });
	const current = getLocale();

	return (
		<nav aria-label={m.language_switcher_label()} className={className}>
			<ul className="flex items-center gap-1 text-sm">
				{locales.map((locale) => {
					const active = locale === current;
					return (
						<li key={locale}>
							<a
								href={localizeHref(href, { locale })}
								hrefLang={locale}
								lang={locale}
								aria-current={active ? "true" : undefined}
								className={cn(
									"rounded-md px-2 py-1 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
									active ? "font-semibold text-foreground" : "text-muted-foreground",
									// On non-Nepali pages, render the Devanagari label with a system font
									// so English pages don't download the 121 kB web font for one word.
									locale === "ne" && current !== "ne" && "font-devanagari-system",
								)}
							>
								{languageNames[locale]()}
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
