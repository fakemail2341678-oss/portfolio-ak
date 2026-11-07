import { fn } from "storybook/test";
import type { AdminReport, AdminReportPage } from "../../../../src/features/parda/admin/schema";

// Stand-ins for src/functions/parda-admin/reports.ts: an open report about ads, a resolved one.
const report = (n: number, extra: Partial<AdminReport>): AdminReport => ({
	id: `00000000-0000-4000-8000-00000000020${n}`,
	kind: "not-playing",
	media: "tv",
	tmdbId: 1399,
	season: 1,
	episode: n,
	title: { en: "Game of Thrones", ne: "गेम अफ थ्रोन्स" },
	source: { id: "00000000-0000-4000-8000-000000000001", name: { en: "Server 1", ne: "सर्भर १" } },
	note: "",
	status: "open",
	reporter: null,
	resolvedBy: null,
	resolvedAt: null,
	createdAt: "2026-11-05T08:00:00.000Z",
	...extra,
});

export const listPardaReports = fn(
	async (): Promise<AdminReportPage> => ({
		items: [
			report(1, { kind: "ads", note: "A pop-up opened on every click." }),
			report(2, { status: "resolved", resolvedBy: "Admin", resolvedAt: "2026-11-05T09:00:00.000Z" }),
		],
		total: 2,
		page: 1,
		pageCount: 1,
	}),
).mockName("listPardaReports");
export const setPardaReportStatus = fn(async (): Promise<{ changed: number }> => ({ changed: 1 })).mockName(
	"setPardaReportStatus",
);
