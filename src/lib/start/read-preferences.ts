import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookies } from "@tanstack/react-start/server";
import { type Preferences, parseCookieHeader, parsePreferences } from "../stores/preferences";

/**
 * Current preferences from cookies: the request's Cookie header during SSR,
 * document.cookie in the browser. Both read the same cookies, so the server
 * render and the first client render agree.
 */
export const readPreferences = createIsomorphicFn()
	.server((): Preferences => parsePreferences(getCookies()))
	.client((): Preferences => parsePreferences(parseCookieHeader(document.cookie)));
