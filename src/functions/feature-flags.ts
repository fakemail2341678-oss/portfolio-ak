import { createServerFn } from "@tanstack/react-start";
import { isFlagEnabled } from "@/server/analytics/posthog";

/** PostHog flag keys used by the app. Create them in PostHog; unknown or absent flags are off. */
export const FLAGS = { homeItemsCta: "home-items-cta" } as const;

export type HomeFlags = { showItemsCta: boolean };

/**
 * Flags for the home page, evaluated on the SERVER. The route loader puts the
 * result in the Query cache, which is dehydrated into the page, so the server
 * render and the hydrated client render use the same value (no flicker, no
 * hydration mismatch, no client-side flag request).
 */
export const getHomeFlags = createServerFn({ method: "GET" }).handler(
	async (): Promise<HomeFlags> => ({ showItemsCta: await isFlagEnabled(FLAGS.homeItemsCta) }),
);
