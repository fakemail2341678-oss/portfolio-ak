import { m } from "@/paraglide/messages";
import type { TasklineColor } from "./types";

/**
 * The CSS values of Taskline's colours (projects, statuses, labels; stored by name,
 * `TASKLINE_COLORS`). A middle lightness that reads on both themes (at least 3:1
 * against either background: enough for a swatch, a dot or a bar, never for text).
 */
const VALUES: Record<TasklineColor, string> = {
	gray: "oklch(0.6 0.02 260)",
	red: "oklch(0.62 0.2 25)",
	orange: "oklch(0.66 0.17 50)",
	amber: "oklch(0.7 0.15 80)",
	green: "oklch(0.62 0.15 150)",
	teal: "oklch(0.62 0.11 190)",
	blue: "oklch(0.6 0.16 255)",
	indigo: "oklch(0.56 0.17 275)",
	violet: "oklch(0.6 0.18 295)",
	pink: "oklch(0.63 0.19 350)",
};

export const tasklineColor = (color: TasklineColor): string => VALUES[color];

/** The colours' names, for pickers and screen readers. */
export const TASKLINE_COLOR_LABELS: Record<TasklineColor, () => string> = {
	gray: m.taskline_color_gray,
	red: m.taskline_color_red,
	orange: m.taskline_color_orange,
	amber: m.taskline_color_amber,
	green: m.taskline_color_green,
	teal: m.taskline_color_teal,
	blue: m.taskline_color_blue,
	indigo: m.taskline_color_indigo,
	violet: m.taskline_color_violet,
	pink: m.taskline_color_pink,
};
