import "@tanstack/react-start/server-only";
import {
	type ChaalFeaturedItem,
	type ChaalFeaturedSection,
	type ChaalHome,
	featuredState,
	mergedSections,
	sectionOf,
} from "@/features/chaal/home/curation";
import { todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import type { ChaalControls } from "./controls";

/** How many items a featured section shows at most. */
export const FEATURED_SHOWN = 6;

/** Today in Kathmandu: what featured dates are read against (as Parda's billboard, decision 0242). */
export const chaalToday = (now: Date = new Date()) => todayInZone(APP_TIME_ZONE, now);

/**
 * What /app/chaal shows under its hero (PLAN Task 84, decision 0274): the sections in the
 * admin's order without the hidden ones, the featured items showing today, and the
 * announcement. A featured section with nothing showing, or the announcement without
 * English, isn't listed, so the page never draws an empty section.
 */
export async function chaalHome(
	controls: Pick<ChaalControls, "settings" | "curation">,
	now: Date = new Date(),
): Promise<ChaalHome> {
	const [settings, curation] = await Promise.all([controls.settings(), controls.curation()]);
	const today = chaalToday(now);
	const featured: Record<ChaalFeaturedSection, ChaalFeaturedItem[]> = {
		broadcasts: [],
		tournaments: [],
		studies: [],
		themes: [],
	};
	for (const row of curation.featured) {
		const list = featured[sectionOf(row.kind)];
		if (featuredState(row, today) !== "live" || list.length >= FEATURED_SHOWN) continue;
		list.push({ id: row.id, kind: row.kind, ref: row.ref, title: row.title });
	}
	const announcement = settings.announcement?.en.trim() ? settings.announcement : null;
	const sections = mergedSections(curation.sections).flatMap(({ key, visible }) => {
		if (!visible) return [];
		if (key === "announcement") return announcement ? [key] : [];
		if (key === "start") return [key];
		return featured[key].length > 0 ? [key] : [];
	});
	return { sections, featured, announcement };
}
