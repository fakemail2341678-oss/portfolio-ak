import { fn } from "storybook/test";
import type { AdminSource, AdminSourceStanding } from "../../../../src/features/parda/admin/schema";

// Stand-ins for src/functions/parda-admin/sources.ts: the seeded servers, one pinned, one disabled,
// with a day of standings: viewers' numbers, the probe's only, and none.
const standing = (extra: Partial<AdminSourceStanding> = {}): AdminSourceStanding => ({
	day: "2026-11-04",
	score: 0.8125,
	from: "viewers",
	plays: 214,
	failureRate: 0.042,
	startMedianMs: 4200,
	stallPerMinute: 0.6,
	popupsPerClick: 0.25,
	probeRuns: 3,
	probedAt: "2026-11-04T01:58:00.000Z",
	...extra,
});

const server = (n: number, extra: Partial<AdminSource> = {}): AdminSource => ({
	id: `00000000-0000-4000-8000-00000000000${n}`,
	name: { en: `Server ${n}`, ne: `सर्भर ${n}` },
	movieTemplate: `/${n}/movie/{id}?start={start}&lang={lang}`,
	tvTemplate: `/${n}/tv/{id}/{season}/{episode}?start={start}&lang={lang}`,
	origins: [],
	adapter: "parda",
	sandbox: "none",
	adaptive: n % 2 === 0 ? "yes" : "probe",
	quality: "probe",
	needsClick: false,
	cdnGroup: n <= 2 ? "placeholder-a" : "placeholder-b",
	autoFallback: true,
	enabled: true,
	pinned: false,
	position: n - 1,
	rank: n - 1,
	updatedAt: "1",
	openReports: 0,
	adsReports: 0,
	height: 1080,
	heightFrom: "probe",
	adaptiveNow: n % 2 === 0,
	standing: standing(),
	...extra,
});

export const PARDA_STORY_SOURCES: AdminSource[] = [
	server(1, { pinned: true, openReports: 3, adsReports: 1 }),
	server(2, { quality: "720", height: 720, heightFrom: "admin", standing: standing({ score: 0.7412, plays: 96 }) }),
	server(3, {
		sandbox: "popups",
		standing: standing({ score: 0.65, from: "probe", plays: 7, failureRate: 0, startMedianMs: 3100 }),
	}),
	server(4, { enabled: false, rank: null, height: null, heightFrom: null, standing: null }),
];

export const listPardaSources = fn(async (): Promise<AdminSource[]> => PARDA_STORY_SOURCES).mockName(
	"listPardaSources",
);
export const getPardaSource = fn(async (): Promise<AdminSource> => server(1)).mockName("getPardaSource");
export const createPardaSource = fn(async (): Promise<AdminSource> => server(5)).mockName("createPardaSource");
export const updatePardaSource = fn(async (): Promise<AdminSource> => server(1)).mockName("updatePardaSource");
export const setPardaSourceState = fn(async (): Promise<AdminSource> => server(1)).mockName("setPardaSourceState");
export const reorderPardaSources = fn(async (): Promise<{ moved: number }> => ({ moved: 0 })).mockName(
	"reorderPardaSources",
);
export const deletePardaSources = fn(async (): Promise<{ deleted: number }> => ({ deleted: 1 })).mockName(
	"deletePardaSources",
);
