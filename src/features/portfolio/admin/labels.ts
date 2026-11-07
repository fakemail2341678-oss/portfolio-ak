import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type {
	ArchitectureTier,
	AvailabilityStatus,
	CoverMotif,
	MessageStateFilter,
	MetricFormat,
	PortfolioStatus,
} from "../constants";

/** Localized names of the portfolio admin's enum values. Message functions, called at render time. */

export const STATUS_LABELS: Record<PortfolioStatus, () => string> = {
	draft: m.portfolio_admin_status_draft,
	published: m.portfolio_admin_status_published,
};

/** Each status as a badge: drafts neutral, published green. */
export const PORTFOLIO_STATUS = defineStatuses<PortfolioStatus>({
	draft: { tone: "neutral", label: m.portfolio_admin_status_draft },
	published: { tone: "success", label: m.portfolio_admin_status_published },
});

export const STATUS_FILTER_LABELS: Record<"all" | PortfolioStatus, () => string> = {
	all: m.portfolio_admin_status_all,
	...STATUS_LABELS,
};

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, () => string> = {
	open: m.portfolio_availability_open,
	limited: m.portfolio_availability_limited,
	closed: m.portfolio_availability_closed,
};

export const MOTIF_LABELS: Record<CoverMotif, () => string> = {
	grid: m.portfolio_admin_motif_grid,
	orbit: m.portfolio_admin_motif_orbit,
	waves: m.portfolio_admin_motif_waves,
	blocks: m.portfolio_admin_motif_blocks,
	type: m.portfolio_admin_motif_type,
	terrain: m.portfolio_admin_motif_terrain,
	signal: m.portfolio_admin_motif_signal,
};

export const METRIC_FORMAT_LABELS: Record<MetricFormat, () => string> = {
	number: m.portfolio_admin_format_number,
	compact: m.portfolio_admin_format_compact,
	percent: m.portfolio_admin_format_percent,
	multiplier: m.portfolio_admin_format_multiplier,
	plus: m.portfolio_admin_format_plus,
	ms: m.portfolio_admin_format_ms,
	seconds: m.portfolio_admin_format_seconds,
};

export const TIER_LABELS: Record<ArchitectureTier, () => string> = {
	client: m.portfolio_architecture_client,
	edge: m.portfolio_architecture_edge,
	service: m.portfolio_architecture_service,
	data: m.portfolio_architecture_data,
};

export const MESSAGE_FILTER_LABELS: Record<MessageStateFilter, () => string> = {
	inbox: m.messages_filter_inbox,
	unread: m.messages_filter_unread,
	archived: m.messages_filter_archived,
	all: m.messages_filter_all,
};
