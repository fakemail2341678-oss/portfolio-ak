import { ScriptOnce } from "@tanstack/react-router";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/stores/hooks";
import { type Preferences, THEMES, type ThemePreference } from "@/lib/stores/preferences";
import { m } from "@/paraglide/messages";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Attributes for <html>: the theme and the Graphite presets (accent, radius, density;
 * src/styles/app.css). They come from the preference cookies, so the server renders
 * them and nothing flashes; a change in the store re-renders them at once. An explicit
 * "dark" choice is dark from the first byte. "system" can only be resolved in the
 * browser: SystemThemeScript does that before first paint.
 */
export const preferenceHtmlProps = ({
	theme,
	accent,
	radius,
	density,
}: Pick<Preferences, "theme" | "accent" | "radius" | "density">) => ({
	className: theme === "dark" ? "dark" : undefined,
	"data-theme": theme,
	"data-accent": accent,
	"data-radius": radius,
	"data-density": density,
});

/**
 * Inline, render-blocking script in <head> (TanStack Router's ScriptOnce: emitted
 * only in the SSR HTML, removes itself, picks up the CSP nonce). For "system" it
 * adds .dark before the body paints when the OS is in dark mode, so there is no
 * light flash. <html> has suppressHydrationWarning because this class is added
 * before React hydrates.
 */
export function SystemThemeScript() {
	return (
		<ScriptOnce>
			{`(function(){var d=document.documentElement;if(d.dataset.theme==="system"&&window.matchMedia("${DARK_QUERY}").matches)d.classList.add("dark")})()`}
		</ScriptOnce>
	);
}

/** Keeps <html class="dark"> in sync with the theme in force (the preference as the section resolves it) and, for "system", with OS changes. */
export function ThemeSync({ theme }: { theme: ThemePreference }) {
	// Layout effect: React clears className when leaving "dark"; re-apply before paint.
	useLayoutEffect(() => {
		const root = document.documentElement;
		const media = window.matchMedia(DARK_QUERY);
		const apply = () => root.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
		apply();
		if (theme !== "system") return;
		media.addEventListener("change", apply);
		return () => media.removeEventListener("change", apply);
	}, [theme]);
	return null;
}

/** Icon and name of each theme, for every place that offers the choice (toggle, user menu, palette, appearance). */
export const THEME_ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const;
export const THEME_LABELS: Record<ThemePreference, () => string> = {
	light: m.theme_light,
	dark: m.theme_dark,
	system: m.theme_system,
};

export const isTheme = (value: string): value is ThemePreference => (THEMES as ReadonlyArray<string>).includes(value);

/** Light / dark / system picker for the header. */
export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const Icon = THEME_ICONS[theme];
	// Non-modal: a small menu shouldn't aria-hide the page (it closes on Escape or outside click).
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={`${m.theme_label()}: ${THEME_LABELS[theme]()}`}
					data-testid="theme-toggle"
				>
					<Icon aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>{m.theme_label()}</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={theme} onValueChange={(value) => isTheme(value) && setTheme(value)}>
					{THEMES.map((option) => {
						const OptionIcon = THEME_ICONS[option];
						return (
							<DropdownMenuRadioItem key={option} value={option}>
								<OptionIcon aria-hidden />
								{THEME_LABELS[option]()}
							</DropdownMenuRadioItem>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
