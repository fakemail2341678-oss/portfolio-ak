import { fn } from "storybook/test";
import type {
	__Pascal__Detail,
	__Pascal__ListItem,
	__Pascal__Page,
} from "../../../src/features/__name__/schema";

export const sample__Pascal__: __Pascal__Detail = {
	id: "5b2f7c1e-8d4a-4f6b-9c3e-2a1d0e9f8b7c",
{{#localized}}
	title: { en: "Sample row", ne: "नमुना पङ्क्ति" },
	notes: { en: "Notes about the sample row.", ne: "" },
{{/localized}}
{{^localized}}
	title: "Sample row",
	notes: "Notes about the sample row.",
{{/localized}}
{{#public}}
	slug: "sample-row",
	published: true,
{{/public}}
	createdAt: "2026-01-10T09:00:00.000Z",
	updatedAt: "2026-01-12T15:30:00.000Z",
};

export const sample__Pascal__Rows: __Pascal__ListItem[] = [
	sample__Pascal__,
	{
		id: "0c9e8f7a-6b5d-4c3e-8f2a-1b0c9d8e7f6a",
		title: {{#localized}}{ en: "Another row", ne: "" }{{/localized}}{{^localized}}"Another row"{{/localized}},
{{#public}}
		slug: "another-row",
		published: false,
{{/public}}
		updatedAt: "2026-01-11T08:00:00.000Z",
	},
];

// Stand-ins for src/functions/__name__.ts.
export const list__Pascal__ = fn(
	async (): Promise<__Pascal__Page> => ({
		items: sample__Pascal__Rows,
		total: sample__Pascal__Rows.length,
		page: 1,
		pageCount: 1,
	}),
).mockName("list__Pascal__");
export const get__Pascal__ = fn(async (): Promise<__Pascal__Detail> => sample__Pascal__).mockName("get__Pascal__");
{{#public}}
export const is__Pascal__SlugFree = fn(async (): Promise<boolean> => true).mockName("is__Pascal__SlugFree");
{{/public}}
export const create__Pascal__ = fn(
	async (_options: { data: unknown }): Promise<__Pascal__Detail> => sample__Pascal__,
).mockName("create__Pascal__");
export const update__Pascal__ = fn(
	async (_options: { data: unknown }): Promise<__Pascal__Detail> => sample__Pascal__,
).mockName("update__Pascal__");
export const delete__Pascal__ = fn(async () => ({ deleted: 1 })).mockName("delete__Pascal__");
