import { createMiddleware } from "@tanstack/react-start";
import { getLocale } from "@/paraglide/runtime.js";
import { LOCALE_HEADER } from "../lib/i18n/locale-header";

/**
 * Server function requests go to /_serverFn/... without a locale prefix, so the
 * URL strategy can't see the page locale. The client half of this middleware
 * sends it as a header; the `custom-header` Paraglide strategy (src/server.ts)
 * reads it, so getLocale() inside handlers matches the page that called them.
 */
export const localeFunctionMiddleware = createMiddleware({ type: "function" }).client(({ next }) =>
	next({ headers: { [LOCALE_HEADER]: getLocale() } }),
);
