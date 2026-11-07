// Tailwind, design tokens and the self-hosted Inter + Noto Sans Devanagari fonts.
import "../src/styles/app.css";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type Locale, locales, overwriteGetLocale } from "../src/paraglide/runtime";
import { type AppParameters, AppProviders } from "./app-providers";

type Theme = "light" | "dark";

/**
 * The Vitest "storybook-dark-ne" project defines STORYBOOK_VARIANT to run every
 * story a second time in Nepali with the dark theme (vitest.config.ts).
 */
const variant: string | undefined = import.meta.env.STORYBOOK_VARIANT;
export const INITIAL_GLOBALS =
	variant === "dark-ne" ? { locale: "ne", theme: "dark" } : { locale: "en", theme: "light" };

/** Toolbar: language (en/ne) and theme (light/dark), applied like the app does. */
const withLocaleAndTheme: Decorator = (Story, context) => {
	const locale = (context.globals.locale ?? "en") as Locale;
	const theme = (context.globals.theme ?? "light") as Theme;
	// Paraglide messages and Intl helpers read getLocale() at render time.
	overwriteGetLocale(() => locale);
	document.documentElement.lang = locale;
	document.documentElement.classList.toggle("dark", theme === "dark");
	document.body.classList.add("bg-background", "text-foreground");
	return (
		// Keyed by locale + theme: a toolbar change remounts the providers with fresh state.
		<AppProviders key={`${locale}-${theme}`} parameters={(context.parameters.app ?? {}) as AppParameters} theme={theme}>
			<Story />
		</AppProviders>
	);
};

const preview: Preview = {
	decorators: [withLocaleAndTheme],
	globalTypes: {
		locale: {
			description: "Language",
			toolbar: {
				title: "Language",
				icon: "globe",
				items: locales.map((locale) => ({ value: locale, title: locale === "en" ? "English" : "नेपाली" })),
				dynamicTitle: true,
			},
		},
		theme: {
			description: "Theme",
			toolbar: {
				title: "Theme",
				icon: "mirror",
				items: [
					{ value: "light", title: "Light", icon: "sun" },
					{ value: "dark", title: "Dark", icon: "moon" },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: INITIAL_GLOBALS,
	parameters: {
		layout: "padded",
		// Accessibility violations fail the story (in the Vitest run and the a11y panel).
		a11y: { test: "error" },
		controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
	},
};

export default preview;
