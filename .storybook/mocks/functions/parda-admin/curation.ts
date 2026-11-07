import { fn } from "storybook/test";
import type {
	AdminBillboard,
	AdminCollection,
	AdminLayout,
	TitleOption,
} from "../../../../src/features/parda/admin/schema";

// Stand-ins for src/functions/parda-admin/curation.ts.
const billboard: AdminBillboard = {
	id: "00000000-0000-4000-8000-000000000201",
	page: "home",
	media: "movie",
	tmdbId: 550,
	title: { en: "Fight Club", ne: "फाइट क्लब" },
	tagline: { en: "Mischief. Mayhem. Soap.", ne: "" },
	startsOn: "2026-11-01",
	endsOn: "2026-11-30",
	state: "live",
	updatedAt: "1",
};
const collection: AdminCollection = {
	id: "00000000-0000-4000-8000-000000000301",
	name: { en: "Festival picks", ne: "चाडपर्वका छनोट" },
	slug: "festival-picks",
	description: { en: "", ne: "" },
	published: true,
	count: 2,
	items: [
		{ ref: "movie:550", media: "movie", tmdbId: 550, title: { en: "Fight Club", ne: "फाइट क्लब" } },
		{ ref: "tv:1396", media: "tv", tmdbId: 1396, title: { en: "Breaking Bad", ne: "ब्रेकिङ ब्याड" } },
	],
	updatedAt: "1",
	modifiedAt: "2026-11-04T10:00:00.000Z",
};
const layout: AdminLayout = {
	page: "home",
	saved: true,
	rails: [
		{ key: "top10", visible: true, label: { key: "top10" }, collection: null },
		{
			key: `c-${collection.id}`,
			visible: true,
			label: { text: collection.name.en },
			collection: { name: collection.name, published: true },
		},
		{ key: "trending", visible: true, label: { key: "trending" }, collection: null },
		{ key: "upcoming", visible: false, label: { key: "upcoming" }, collection: null },
	],
};

export const searchPardaTitles = fn(
	async (): Promise<TitleOption[]> => [{ ref: "movie:550", media: "movie", id: 550, title: "Fight Club", year: 1999 }],
).mockName("searchPardaTitles");
export const listPardaBillboards = fn(async (): Promise<AdminBillboard[]> => [billboard]).mockName(
	"listPardaBillboards",
);
export const getPardaBillboard = fn(async (): Promise<AdminBillboard> => billboard).mockName("getPardaBillboard");
export const createPardaBillboard = fn(async (): Promise<AdminBillboard> => billboard).mockName("createPardaBillboard");
export const updatePardaBillboard = fn(async (): Promise<AdminBillboard> => billboard).mockName("updatePardaBillboard");
export const reorderPardaBillboards = fn(async (): Promise<{ moved: number }> => ({ moved: 0 })).mockName(
	"reorderPardaBillboards",
);
export const deletePardaBillboards = fn(async (): Promise<{ deleted: number }> => ({ deleted: 1 })).mockName(
	"deletePardaBillboards",
);
export const listPardaCollections = fn(async (): Promise<AdminCollection[]> => [collection]).mockName(
	"listPardaCollections",
);
export const getPardaAdminCollection = fn(async (): Promise<AdminCollection> => collection).mockName(
	"getPardaAdminCollection",
);
export const createPardaCollection = fn(async (): Promise<AdminCollection> => collection).mockName(
	"createPardaCollection",
);
export const updatePardaCollection = fn(async (): Promise<AdminCollection> => collection).mockName(
	"updatePardaCollection",
);
export const deletePardaCollections = fn(async (): Promise<{ deleted: number }> => ({ deleted: 1 })).mockName(
	"deletePardaCollections",
);
export const getPardaLayout = fn(async (): Promise<AdminLayout> => layout).mockName("getPardaLayout");
export const savePardaLayout = fn(async (): Promise<AdminLayout> => layout).mockName("savePardaLayout");
