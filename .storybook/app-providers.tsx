import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useState } from "react";
import { ConfirmProvider } from "../src/components/dialogs/confirm";
import { sessionQueryOptions } from "../src/features/auth/queries";
import { parseSearch, stringifySearch } from "../src/lib/list/url";
import type { Session } from "../src/lib/session";
import { createPreferencesStore, DEFAULT_PREFERENCES, type Preferences } from "../src/lib/stores/preferences";
import { deLocalizeUrl, localizeUrl } from "../src/paraglide/runtime";
import type { RouterContext } from "../src/router";

/** Per-story app context: what the real router provides (see src/router.tsx). */
export type AppParameters = {
	/** Signed-in session for the header etc. (default: anonymous). */
	session?: Session | null;
	/** Preference overrides (theme comes from the toolbar). */
	preferences?: Partial<Preferences>;
	/** Initial URL, e.g. "/admin/test-crud" so active links highlight. */
	route?: string;
};

const StoryContext = createContext<ReactNode>(null);

/** The story inside the router, with the confirm dialog the shells provide (useConfirm). */
function StoryOutlet() {
	return <ConfirmProvider>{useContext(StoryContext)}</ConfirmProvider>;
}

function createStoryRouter({ session = null, preferences, route = "/" }: AppParameters, theme: Preferences["theme"]) {
	// Never refetch: stories render seeded data and must not hit (mocked) server functions in a loop.
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
	});
	queryClient.setQueryData(sessionQueryOptions().queryKey, session);
	const rootRoute = createRootRouteWithContext<RouterContext>()({ component: StoryOutlet });
	// One catch-all route so any initial URL renders the story (and `Link`s resolve).
	const catchAll = createRoute({ getParentRoute: () => rootRoute, path: "$", component: StoryOutlet });
	return {
		queryClient,
		router: createRouter({
			routeTree: rootRoute.addChildren([catchAll]),
			history: createMemoryHistory({ initialEntries: [route] }),
			context: {
				queryClient,
				preferences: createPreferencesStore({ ...DEFAULT_PREFERENCES, theme, ...preferences }),
				session,
			} satisfies RouterContext,
			// Same URL handling as the app: repeated-key arrays, and Links in Nepali point at /ne/...
			parseSearch,
			stringifySearch,
			rewrite: { input: ({ url }) => deLocalizeUrl(url), output: ({ url }) => localizeUrl(url) },
		}),
	};
}

/**
 * Wraps a story in the app's providers: TanStack Router (memory history),
 * Query, the TanStack DB client and the preferences store. The router is created
 * once per story mount; the story itself re-renders on toolbar changes.
 */
export function AppProviders({
	children,
	parameters,
	theme,
}: {
	children: ReactNode;
	parameters: AppParameters;
	theme: Preferences["theme"];
}) {
	const [{ router, queryClient }] = useState(() => createStoryRouter(parameters, theme));
	return (
		<QueryClientProvider client={queryClient}>
			<StoryContext.Provider value={children}>
				<RouterProvider router={router} />
			</StoryContext.Provider>
		</QueryClientProvider>
	);
}
