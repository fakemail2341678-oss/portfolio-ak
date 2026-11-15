// Tailwind, design tokens and the self-hosted Inter + Noto Sans Devanagari fonts.
import "../src/styles/app.css";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type Locale, locales, overwriteGetLocale } from "../src/paraglide/runtime";
import { type AppParameters, AppProviders } from "./app-providers";
import { storyVariant } from "./variant";

type Theme = "light" | "dark";

/**
 * Toolbar: language (en/ne) and theme (light/dark), applied like the app does.
 *
 * The Vitest instance "storybook-dark-ne" runs every story a second time in Nepali with the dark
 * theme (vitest.config.ts). Its variant is read here, when a story renders, not in `initialGlobals`:
 * this module can be evaluated before the instance's setup file has run (./variant.ts).
 */
const withLocaleAndTheme: Decorator = (Story, context) => {
	const darkNe = storyVariant() === "dark-ne";
	const locale = (darkNe ? "ne" : (context.globals.locale ?? "en")) as Locale;
	const theme = (darkNe ? "dark" : (context.globals.theme ?? "light")) as Theme;
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
	initialGlobals: { locale: "en", theme: "light" },
	parameters: {
		layout: "padded",
		// Accessibility violations fail the story (in the Vitest run and the a11y panel).
		a11y: { test: "error" },
		controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
	},
};

export default preview;
