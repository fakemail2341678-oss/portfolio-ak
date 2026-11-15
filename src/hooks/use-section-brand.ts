import { useMatches } from "@tanstack/react-router";
import { sectionBrandOf } from "@/lib/section-brand";

/** What the document needs of the deepest matched section's brand (a selection can't carry its `links` function). */
export const useSectionBrand = () =>
	useMatches({
		select: (matches) => {
			const brand = sectionBrandOf(matches);
			if (!brand) return undefined;
			const { id, accent, defaultScheme, themeColors } = brand;
			return { id, accent, defaultScheme, themeColors };
		},
		structuralSharing: true,
	});
