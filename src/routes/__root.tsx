import { TanStackDevtools } from "@tanstack/react-devtools";
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { ClientOnly, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { lazy, type ReactNode, Suspense } from "react";
import { ErrorPage } from "@/components/errors/error-page";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { ConsentBanner, ObservabilitySync } from "@/components/layout/observability";
import { SkipLink } from "@/components/layout/skip-link";
import { preferenceHtmlProps, SystemThemeScript, ThemeSync } from "@/components/layout/theme";
import { sessionQueryOptions } from "@/features/auth/queries";
import { sectionBrandOf, sectionTheme, useSectionBrand } from "@/lib/section-brand";
import { pageTitle } from "@/lib/seo";
import type { Session } from "@/lib/session";
import { skipsSession } from "@/lib/session-scope";
import { useAppearance } from "@/lib/stores/hooks";
import type { ThemePreference } from "@/lib/stores/preferences";
import { m } from "@/paraglide/messages";
import { getLocale, getTextDirection, localizeHref } from "@/paraglide/runtime";
import type { RouterContext } from "@/router";
import appCss from "@/styles/app.css?url";

export const Route = createRootRouteWithContext<RouterContext>()({
	// Fill the session slot for every route. On the server this is a per-request
	// lookup. In the browser it comes from the Query cache while it's fresh (its
	// staleTime), then is fetched again, so route guards never trust a session
	// that expired long ago. Server functions check the session themselves either way.
	// Sections that never read it (staticData.session = "skip": the portfolio) get
	// null without a lookup; navigating on to any other page looks it up again.
	beforeLoad: async ({ context, matches }): Promise<{ session: Session | null }> => ({
		session: skipsSession(matches) ? null : await context.queryClient.query(sessionQueryOptions()),
	}),
	head: ({ matches }) => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			// Default title; child routes override it with pageTitle("…").
			{ title: pageTitle() },
			{ name: "description", content: m.site_description() },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			// A section that is its own product brings its own icons and manifest (decision 0208).
			...(sectionBrandOf(matches)?.links() ?? [
				// Icon set: SVG for modern browsers, ICO for the rest, PNG for iOS; the manifest has the app icons.
				{ rel: "icon", href: "/favicon.ico", sizes: "32x32" },
				{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
				{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
				{ rel: "manifest", href: localizeHref("/manifest.webmanifest") },
			]),
		],
	}),
	errorComponent: ErrorPage,
	notFoundComponent: NotFoundPage,
	shellComponent: RootDocument,
});

/**
 * Toasts render only in the browser, after hydration, so sonner (about 10 kB gzip) is not
 * part of every page's entry chunk. toast() calls made earlier are replayed when it mounts.
 */
const Toaster = lazy(() => import("@/components/ui/sonner").then((module) => ({ default: module.Toaster })));

/**
 * Browser UI colour: Graphite's --background of the chosen theme (oklch(0.995 0.0015 265) and
 * oklch(0.165 0.005 265) in app.css), or both for "system" (head() dedupes meta by name).
 */
const THEME_COLORS = { light: "#fdfdfe", dark: "#0d0e11" } as const;

function ThemeColor({
	theme,
	colors = THEME_COLORS,
}: {
	theme: ThemePreference;
	colors?: { light: string; dark: string } | undefined;
}) {
	if (theme !== "system") return <meta name="theme-color" content={colors[theme]} />;
	return (
		<>
			<meta name="theme-color" media="(prefers-color-scheme: light)" content={colors.light} />
			<meta name="theme-color" media="(prefers-color-scheme: dark)" content={colors.dark} />
		</>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	const locale = getLocale();
	const appearance = useAppearance();
	const brand = useSectionBrand();
	// The theme in force: a branded section may resolve "system" itself (decision 0232).
	const theme = sectionTheme(appearance.theme, brand);
	// A branded section's accent wins over the visitor's (on <html>, so portalled menus match too).
	const accent = brand?.accent ?? appearance.accent;
	return (
		// suppressHydrationWarning: SystemThemeScript may add class="dark" before hydration (this element only).
		<html
			lang={locale}
			dir={getTextDirection(locale)}
			data-section={brand?.id}
			{...preferenceHtmlProps({ ...appearance, theme, accent })}
			suppressHydrationWarning
		>
			<head>
				<SystemThemeScript />
				<ThemeColor theme={theme} colors={brand?.themeColors} />
				<HeadContent />
			</head>
			<body className="flex min-h-dvh flex-col">
				<SkipLink />
				<ImpersonationBanner />
				<div className="flex flex-1 flex-col">{children}</div>
				<ThemeSync theme={theme} />
				<ObservabilitySync />
				<ConsentBanner />
				<ClientOnly>
					<Suspense>
						<Toaster theme={theme} />
					</Suspense>
				</ClientOnly>
				{/* Dev only: @tanstack/devtools-vite removes this and its panels from builds. */}
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{ name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
						{ name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
						{ name: "TanStack Form", render: (_el, props) => <FormDevtoolsPanel {...props} /> },
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
