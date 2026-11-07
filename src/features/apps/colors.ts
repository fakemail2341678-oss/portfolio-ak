import { m } from "@/paraglide/messages";

/**
 * The colours a user picks for an expense category or a habit (decision 0192). One
 * value per name that reads on both themes (a middle lightness: at least 3:1 against
 * the light and the dark background, enough for a swatch or a chart mark), stored by
 * name so the palette can be retuned without touching rows.
 */
export const APP_COLORS = ["slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"] as const;
export type AppColor = (typeof APP_COLORS)[number];

const VALUES: Record<AppColor, string> = {
	slate: "oklch(0.6 0.03 257)",
	red: "oklch(0.62 0.2 25)",
	orange: "oklch(0.66 0.17 50)",
	amber: "oklch(0.7 0.15 80)",
	green: "oklch(0.62 0.15 150)",
	teal: "oklch(0.62 0.11 190)",
	blue: "oklch(0.6 0.16 255)",
	violet: "oklch(0.6 0.18 295)",
	pink: "oklch(0.63 0.19 350)",
};

/** The CSS colour of a palette name. */
export const appColor = (color: AppColor): string => VALUES[color];

export const isAppColor = (value: string): value is AppColor => APP_COLORS.some((color) => color === value);

/** The colours' names, for pickers and screen readers. */
export const APP_COLOR_LABELS: Record<AppColor, () => string> = {
	slate: m.apps_color_slate,
	red: m.apps_color_red,
	orange: m.apps_color_orange,
	amber: m.apps_color_amber,
	green: m.apps_color_green,
	teal: m.apps_color_teal,
	blue: m.apps_color_blue,
	violet: m.apps_color_violet,
	pink: m.apps_color_pink,
};
