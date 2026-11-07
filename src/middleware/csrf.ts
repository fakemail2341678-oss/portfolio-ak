import { createCsrfMiddleware } from "@tanstack/react-start";

/**
 * Server functions are same-origin RPC endpoints. This rejects cross-site calls
 * (checked via Sec-Fetch-Site, then Origin, then Referer) with 403, following
 * TanStack Start's recommended setup. Page requests are not affected.
 */
export const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});
