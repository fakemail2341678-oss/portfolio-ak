import { describe, expect, it } from "vitest";
import { preferenceHtmlProps } from "@/components/layout/theme";
import { type SectionBrand, sectionBrandOf, sectionTheme } from "@/lib/section-brand";
import { DEFAULT_PREFERENCES } from "@/lib/stores/preferences";

const brand = (extra: Partial<SectionBrand> = {}): SectionBrand => ({
	id: "demo",
	accent: "rose",
	links: () => [],
	...extra,
});

describe("sectionTheme", () => {
	const darkByDefault = brand({ defaultScheme: "dark" });

	it("resolves system to the section's default scheme, so the server renders it", () => {
		expect(sectionTheme("system", darkByDefault)).toBe("dark");
		const props = preferenceHtmlProps({ ...DEFAULT_PREFERENCES, theme: sectionTheme("system", darkByDefault) });
		expect(props.className).toBe("dark");
		expect(props["data-theme"]).toBe("dark");
	});

	it("lets an explicit choice win", () => {
		expect(sectionTheme("light", darkByDefault)).toBe("light");
		expect(sectionTheme("dark", darkByDefault)).toBe("dark");
	});

	it("leaves the preference alone without a default scheme or a brand", () => {
		expect(sectionTheme("system", brand())).toBe("system");
		expect(sectionTheme("system", undefined)).toBe("system");
	});
});

describe("sectionBrandOf", () => {
	it("takes the deepest match's brand", () => {
		const outer = brand({ id: "outer" });
		const inner = brand({ id: "inner" });
		const matches = [{ staticData: { brand: outer } }, { staticData: {} }, { staticData: { brand: inner } }];
		expect(sectionBrandOf(matches)?.id).toBe("inner");
		expect(sectionBrandOf(undefined)).toBeUndefined();
	});
});
