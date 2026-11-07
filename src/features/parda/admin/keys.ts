import type { PardaPage } from "../search";
import type { PardaOverviewRange, PardaReportListInput, PardaTakedownListInput } from "./search";

/** Parda's admin reads, under one root so a write can refresh what it touched. */
const all = ["parda-admin"] as const;

export const pardaAdminKeys = {
	all,
	labSources: () => [...all, "lab-sources"] as const,
	sources: () => [...all, "sources", "list"] as const,
	source: (id: string) => [...all, "source", id] as const,
	takedowns: () => [...all, "takedowns"] as const,
	takedownList: (input: PardaTakedownListInput) => [...all, "takedowns", input] as const,
	reports: () => [...all, "reports"] as const,
	reportList: (input: PardaReportListInput) => [...all, "reports", input] as const,
	settings: () => [...all, "settings"] as const,
	overview: (range: PardaOverviewRange) => [...all, "overview", range] as const,
	billboards: () => [...all, "billboards", "list"] as const,
	billboard: (id: string) => [...all, "billboard", id] as const,
	collections: () => [...all, "collections", "list"] as const,
	collection: (id: string) => [...all, "collection", id] as const,
	layout: (page: PardaPage) => [...all, "layout", page] as const,
};
