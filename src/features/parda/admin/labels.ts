import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { PardaReportKind, PardaReportStatus } from "../player/lib/playback";
import type { PardaPage } from "../search";
import type { LabSandbox, PardaAdminMedia, SOURCE_ADAPTERS, SOURCE_ADAPTIVE } from "./schema";
import type { PardaReportKindFilter, PardaReportStatusFilter } from "./search";

/** Localized names of Parda's admin values, read at render time. */

export const ADAPTER_LABELS: Readonly<Record<(typeof SOURCE_ADAPTERS)[number], () => string>> = {
	viduki: m.parda_admin_adapter_viduki,
	parda: m.parda_admin_adapter_parda,
	none: m.parda_admin_adapter_none,
};

export const SANDBOX_LABELS: Readonly<Record<LabSandbox, () => string>> = {
	none: m.parda_admin_sandbox_none,
	popups: m.parda_admin_sandbox_popups,
	strict: m.parda_admin_sandbox_strict,
};

/** The admin's word on an adaptive stream, or the probe's (decision 0238). */
export const ADAPTIVE_LABELS: Readonly<Record<(typeof SOURCE_ADAPTIVE)[number], () => string>> = {
	probe: m.parda_admin_source_from_probe,
	yes: m.parda_admin_source_adaptive_yes,
	no: m.parda_admin_source_adaptive_no,
};

export const MEDIA_LABELS: Readonly<Record<PardaAdminMedia, () => string>> = {
	movie: m.parda_lab_media_movie,
	tv: m.parda_lab_media_tv,
};

/** The pages a billboard slot or a layout belongs to. */
export const PAGE_LABELS: Readonly<Record<PardaPage, () => string>> = {
	home: m.parda_nav_home,
	movies: m.parda_hub_movies,
	series: m.parda_hub_series,
	anime: m.parda_hub_anime,
};

export const SLOT_STATES = defineStatuses({
	live: { label: m.parda_admin_slot_live, tone: "success" },
	scheduled: { label: m.parda_admin_slot_scheduled, tone: "info" },
	ended: { label: m.parda_admin_slot_ended, tone: "neutral" },
});

export const REPORT_KIND_LABELS: Readonly<Record<PardaReportKind, () => string>> = {
	"not-playing": m.parda_report_not_playing,
	"wrong-title": m.parda_report_wrong_title,
	quality: m.parda_report_quality,
	"audio-subtitles": m.parda_report_audio,
	ads: m.parda_report_ads,
	other: m.parda_report_other,
};

export const REPORT_KIND_FILTER_LABELS: Readonly<Record<PardaReportKindFilter, () => string>> = {
	all: m.parda_admin_filter_all,
	...REPORT_KIND_LABELS,
};

export const REPORT_STATUS_LABELS: Readonly<Record<PardaReportStatus, () => string>> = {
	open: m.parda_admin_report_open,
	resolved: m.parda_admin_report_resolved,
	dismissed: m.parda_admin_report_dismissed,
};

export const REPORT_STATUS_FILTER_LABELS: Readonly<Record<PardaReportStatusFilter, () => string>> = {
	all: m.parda_admin_filter_all,
	...REPORT_STATUS_LABELS,
};

export const REPORT_STATUS = defineStatuses<PardaReportStatus>({
	open: { tone: "warning", label: m.parda_admin_report_open },
	resolved: { tone: "success", label: m.parda_admin_report_resolved },
	dismissed: { tone: "neutral", label: m.parda_admin_report_dismissed },
});
