import { fn } from "storybook/test";
import type { ChaalAdminCuration, ChaalAdminFeatured } from "../../../../src/features/chaal/admin/schema";
import { type ChaalHomeSectionKey, mergedSections } from "../../../../src/features/chaal/home/curation";
import type { Localized } from "../../../../src/lib/i18n/localized";

// Stand-ins for src/functions/chaal-admin/curation.ts: one of each kind, showing, coming and over.
export const chaalCuration: ChaalAdminCuration = {
	featured: [
		{
			id: "6f1c2a10-0000-4000-8000-000000000001",
			kind: "broadcast",
			ref: "wEuVhT9c",
			title: { en: "World Championship 2026", ne: "विश्व च्याम्पियनसिप २०२६" },
			startsOn: "2026-11-01",
			endsOn: "2026-11-30",
			state: "live",
			updatedAt: "1",
		},
		{
			id: "6f1c2a10-0000-4000-8000-000000000002",
			kind: "broadcast",
			ref: "Qx7pLm2a",
			title: { en: "Nepal Open", ne: "नेपाल ओपन" },
			startsOn: "2026-12-05",
			endsOn: "",
			state: "scheduled",
			updatedAt: "2",
		},
		{
			id: "6f1c2a10-0000-4000-8000-000000000003",
			kind: "arena",
			ref: "Ar3naW1n",
			title: { en: "Saturday blitz arena", ne: "" },
			startsOn: "",
			endsOn: "",
			state: "live",
			updatedAt: "1",
		},
		{
			id: "6f1c2a10-0000-4000-8000-000000000004",
			kind: "swiss",
			ref: "Sw1ssKtm",
			title: { en: "Kathmandu club Swiss", ne: "काठमाडौं क्लब स्विस" },
			startsOn: "",
			endsOn: "2026-10-30",
			state: "ended",
			updatedAt: "1",
		},
		{
			id: "6f1c2a10-0000-4000-8000-000000000005",
			kind: "study",
			ref: "St0dyAbc",
			title: { en: "Rook endgames you must know", ne: "" },
			startsOn: "",
			endsOn: "",
			state: "live",
			updatedAt: "1",
		},
		{
			id: "6f1c2a10-0000-4000-8000-000000000006",
			kind: "theme",
			ref: "fork",
			title: { en: "Forks", ne: "फोर्क" },
			startsOn: "",
			endsOn: "",
			state: "live",
			updatedAt: "1",
		},
	],
	sections: mergedSections([]),
	announcement: { en: "Club night moves to Friday this week.", ne: "यो हप्ता क्लबको साँझ शुक्रबार हुन्छ।" },
};

export const getChaalCuration = fn(async (): Promise<ChaalAdminCuration> => chaalCuration).mockName("getChaalCuration");
export const createChaalFeatured = fn(
	async (): Promise<ChaalAdminFeatured> => chaalCuration.featured[0] as ChaalAdminFeatured,
).mockName("createChaalFeatured");
export const updateChaalFeatured = fn(
	async (): Promise<ChaalAdminFeatured> => chaalCuration.featured[0] as ChaalAdminFeatured,
).mockName("updateChaalFeatured");
export const reorderChaalFeatured = fn(async (): Promise<{ moved: number }> => ({ moved: 2 })).mockName(
	"reorderChaalFeatured",
);
export const deleteChaalFeatured = fn(async (): Promise<{ deleted: number }> => ({ deleted: 1 })).mockName(
	"deleteChaalFeatured",
);
export const saveChaalHomeSections = fn(
	async ({ data }: { data: { sections: Array<{ key: ChaalHomeSectionKey; visible: boolean }> } }) => data.sections,
).mockName("saveChaalHomeSections");
export const saveChaalAnnouncement = fn(
	async ({ data }: { data: { announcement: Localized } }): Promise<Localized> => data.announcement,
).mockName("saveChaalAnnouncement");
