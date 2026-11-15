/**
 * Which pass of the story tests this page belongs to. The Vitest instance "storybook-dark-ne"
 * loads `variant-dark-ne.ts` as a setup file, which sets the global before any story renders;
 * everywhere else (the first instance, `pnpm storybook`, a built Storybook) it is unset.
 *
 * A global, not a `define`: both instances share one Vite server, so they get the same
 * compiled modules (Part 9 Task 99, decision 0296).
 */
export type StoryVariant = "dark-ne";

declare global {
	var __STORY_VARIANT__: StoryVariant | undefined;
}

export const storyVariant = (): StoryVariant | undefined => globalThis.__STORY_VARIANT__;
