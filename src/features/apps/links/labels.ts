import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { LinkDevice, LinkState } from "./types";

/** Whether a link redirects now, and why not (decision 0191). */
export const LINK_STATE = defineStatuses<LinkState>({
	live: { tone: "success", label: m.links_state_live },
	paused: { tone: "neutral", label: m.links_state_paused },
	expired: { tone: "warning", label: m.links_state_expired },
	blocked: { tone: "danger", label: m.links_state_blocked },
	guest: { tone: "info", label: m.links_state_guest },
});

export const LINK_DEVICE_LABELS: Record<LinkDevice, () => string> = {
	desktop: m.links_device_desktop,
	mobile: m.links_device_mobile,
	tablet: m.links_device_tablet,
	bot: m.links_device_bot,
};
