import { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { enumParam } from "@/lib/list/params";
import { PARDA_HUBS } from "../search";

/**
 * The URL contract of Parda's admin lists (PLAN Task 65). Route files import from here,
 * never from ./schema.ts (decision 0151).
 */

export const PARDA_MEDIA_FILTERS = ["all", "movie", "tv"] as const;
export type PardaMediaFilter = (typeof PARDA_MEDIA_FILTERS)[number];

/** /admin/parda/titles: the takedowns, newest first. */
export const pardaTakedownList = listSchema({
	sorts: ["-created", "created"],
	filters: { media: enumParam(PARDA_MEDIA_FILTERS, "all") },
});
export type PardaTakedownSearch = z.output<typeof pardaTakedownList.search>;
export type PardaTakedownListInput = z.output<typeof pardaTakedownList.input>;

export const PARDA_REPORT_STATUS_FILTERS = ["open", "resolved", "dismissed", "all"] as const;
export type PardaReportStatusFilter = (typeof PARDA_REPORT_STATUS_FILTERS)[number];
export const PARDA_REPORT_KIND_FILTERS = [
	"all",
	"not-playing",
	"wrong-title",
	"quality",
	"audio-subtitles",
	"ads",
	"other",
] as const;
export type PardaReportKindFilter = (typeof PARDA_REPORT_KIND_FILTERS)[number];

/** A source's id, or every source. */
const sourceParam = () =>
	z
		.union([z.literal("all"), z.uuid()])
		.default("all")
		.catch("all");

/** /admin/parda/reports: the open ones first by default, newest first. */
export const pardaReportList = listSchema({
	sorts: ["-created", "created"],
	filters: {
		status: enumParam(PARDA_REPORT_STATUS_FILTERS, "open"),
		kind: enumParam(PARDA_REPORT_KIND_FILTERS, "all"),
		source: sourceParam(),
	},
});
export type PardaReportSearch = z.output<typeof pardaReportList.search>;
export type PardaReportListInput = z.output<typeof pardaReportList.input>;

/** /admin/parda/player-lab: `?source=` picks a row ("Test in the lab" on the sources page). */
export const playerLabSearch = z.object({ source: z.uuid().optional().catch(undefined) });

/** /admin/parda: the window the overview's figures cover. */
export const PARDA_OVERVIEW_RANGES = ["today", "7d", "30d"] as const;
export type PardaOverviewRange = (typeof PARDA_OVERVIEW_RANGES)[number];
export const pardaOverviewSearch = z.object({ range: enumParam(PARDA_OVERVIEW_RANGES, "7d") });

/** /admin/parda/billboard and /layout: the page whose slots or rails are shown. */
export const PARDA_PAGES = ["home", ...PARDA_HUBS] as const;
export const pardaPageSearch = z.object({ page: enumParam(PARDA_PAGES, "home") });

/** The tables' preference keys (hidden columns, page size), for the routes and the pages. */
export const PARDA_TAKEDOWNS_TABLE_ID = "parda-takedowns";
export const PARDA_REPORTS_TABLE_ID = "parda-reports";
