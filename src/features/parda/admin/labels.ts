import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { PardaReportKind, PardaReportStatus } from "../player/playback";
import type { PardaPage } from "../search";
import type { LabSandbox, PardaAdminMedia, SOURCE_ADAPTERS, SOURCE_ADAPTIVE } from "./schema";
import type { PardaReportKindFilter, PardaReportStatusFilter } from "./search";

/** Localized names of Parda's admin values, read at render time. */

export const ADAPTER_LABELS: Readonly<Record<(typeof SOURCE_ADAPTERS)[number], () => string>> = {
	viduki: m.pd_admin_adapter_viduki,
	parda: m.pd_admin_adapter_parda,
	none: m.pd_admin_adapter_none,
};

export const SANDBOX_LABELS: Readonly<Record<LabSandbox, () => string>> = {
	none: m.pd_admin_sandbox_none,
	popups: m.pd_admin_sandbox_popups,
	strict: m.pd_admin_sandbox_strict,
};

/** The admin's word on an adaptive stream, or the probe's (decision 0238). */
export const ADAPTIVE_LABELS: Readonly<Record<(typeof SOURCE_ADAPTIVE)[number], () => string>> = {
	probe: m.pd_admin_source_from_probe,
	yes: m.pd_admin_source_adaptive_yes,
	no: m.pd_admin_source_adaptive_no,
};

export const MEDIA_LABELS: Readonly<Record<PardaAdminMedia, () => string>> = {
	movie: m.pd_lab_media_movie,
	tv: m.pd_lab_media_tv,
};

/** The pages a billboard slot or a layout belongs to. */
export const PAGE_LABELS: Readonly<Record<PardaPage, () => string>> = {
	home: m.pd_nav_home,
	movies: m.pd_hub_movies,
	series: m.pd_hub_series,
	anime: m.pd_hub_anime,
};

export const SLOT_STATES = defineStatuses({
	live: { label: m.pd_admin_slot_live, tone: "success" },
	scheduled: { label: m.pd_admin_slot_scheduled, tone: "info" },
	ended: { label: m.pd_admin_slot_ended, tone: "neutral" },
});

export const REPORT_KIND_LABELS: Readonly<Record<PardaReportKind, () => string>> = {
	"not-playing": m.pd_report_not_playing,
	"wrong-title": m.pd_report_wrong_title,
	quality: m.pd_report_quality,
	"audio-subtitles": m.pd_report_audio,
	ads: m.pd_report_ads,
	other: m.pd_report_other,
};

export const REPORT_KIND_FILTER_LABELS: Readonly<Record<PardaReportKindFilter, () => string>> = {
	all: m.pd_admin_filter_all,
	...REPORT_KIND_LABELS,
};

export const REPORT_STATUS_LABELS: Readonly<Record<PardaReportStatus, () => string>> = {
	open: m.pd_admin_report_open,
	resolved: m.pd_admin_report_resolved,
	dismissed: m.pd_admin_report_dismissed,
};

export const REPORT_STATUS_FILTER_LABELS: Readonly<Record<PardaReportStatusFilter, () => string>> = {
	all: m.pd_admin_filter_all,
	...REPORT_STATUS_LABELS,
};

export const REPORT_STATUS = defineStatuses<PardaReportStatus>({
	open: { tone: "warning", label: m.pd_admin_report_open },
	resolved: { tone: "success", label: m.pd_admin_report_resolved },
	dismissed: { tone: "neutral", label: m.pd_admin_report_dismissed },
});
