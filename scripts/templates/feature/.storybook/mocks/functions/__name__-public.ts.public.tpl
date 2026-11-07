import { fn } from "storybook/test";
import type { __Pascal__PublicItem, __Pascal__PublicPage } from "../../../src/features/__name__/schema";

const sample: __Pascal__PublicItem = {
	slug: "sample-row",
{{#localized}}
	title: { en: "Sample row", ne: "नमुना पङ्क्ति" },
	notes: { en: "Notes about the sample row.", ne: "" },
{{/localized}}
{{^localized}}
	title: "Sample row",
	notes: "Notes about the sample row.",
{{/localized}}
	updatedAt: "2026-01-12T15:30:00.000Z",
};

// Stand-ins for src/functions/__name__-public.ts.
export const listPublic__Pascal__ = fn(
	async (): Promise<__Pascal__PublicPage> => ({ items: [sample], total: 1, page: 1, pageCount: 1 }),
).mockName("listPublic__Pascal__");
export const getPublic__Pascal__ = fn(async (): Promise<__Pascal__PublicItem> => sample).mockName(
	"getPublic__Pascal__",
);
