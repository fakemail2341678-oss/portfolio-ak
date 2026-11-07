import { fn } from "storybook/test";

export const FLAGS = { homeItemsCta: "home-items-cta" } as const;
export const getHomeFlags = fn(async () => ({ showItemsCta: false })).mockName("getHomeFlags");
