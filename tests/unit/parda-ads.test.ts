import { describe, expect, it } from "vitest";
import { isPardaAdPath } from "@/features/parda/ads/lib/pages";

/** Where Parda shows ads (decision 0301): the pages a visitor browses, never where they watch or sign in. */
describe("isPardaAdPath", () => {
	it("is true on Parda's browsing pages, in both languages", () => {
		for (const path of [
			"/app/parda",
			"/app/parda/",
			"/app/parda/discover",
			"/app/parda/search",
			"/app/parda/movie/550",
			"/app/parda/tv/1396/credits",
			"/app/parda/person/287",
			"/app/parda/library/list",
			"/app/parda/schedule",
			"/ne/app/parda",
			"/ne/app/parda/movie/550",
		]) {
			expect(isPardaAdPath(path), path).toBe(true);
		}
	});

	it("is false where they watch, sign in or manage profiles, and outside Parda", () => {
		for (const path of [
			"/app/parda/watch/movie/550",
			"/ne/app/parda/watch/tv/1396",
			"/app/parda/party/ABC123",
			"/app/parda/sign-in",
			"/app/parda/sign-up",
			"/app/parda/account",
			"/app/parda/profiles",
			"/admin/parda",
			"/app/pardax",
			"/",
			"/ne",
			"/work/x",
			"/app/taskline",
			"/parda/api/1/movie/550",
		]) {
			expect(isPardaAdPath(path), path).toBe(false);
		}
	});
});
