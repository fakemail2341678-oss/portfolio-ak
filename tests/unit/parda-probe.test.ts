import { describe, expect, it } from "vitest";
import { ladderHeights, positionOf, probePage } from "../../scripts/probe-sources.ts";

/** The probe's pure parts (decision 0238): the ladder from a playlist, positions from any player's messages. */

describe("the probe", () => {
	it("reads a master playlist's ladder, tallest first, and nothing from anything else", () => {
		const playlist = [
			"#EXTM3U",
			"#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360",
			"360.m3u8",
			"#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080",
			"1080.m3u8",
			"#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720",
			"720.m3u8",
			"#EXT-X-STREAM-INF:BANDWIDTH=2900000,RESOLUTION=1280x720",
			"720b.m3u8",
		].join("\n");
		expect(ladderHeights(playlist)).toEqual([1080, 720, 360]);
		expect(ladderHeights("RESOLUTION=1920x1080")).toEqual([]);
		expect(ladderHeights("#EXTM3U\n#EXTINF:6.0,\nseg1.ts")).toEqual([]);
	});

	it("finds a position in our protocol, flat or nested shapes, and JSON strings", () => {
		expect(positionOf({ type: "parda.player", event: { name: "position", position: 12.5 } })).toBe(12.5);
		expect(positionOf({ type: "PLAYER_EVENT", data: { event: "time", currentTime: 30 } })).toBe(30);
		expect(positionOf(JSON.stringify({ type: "PLAYER_EVENT", data: { currentTime: 7 } }))).toBe(7);
		// Viduki's MEDIA_DATA (decision 0248): a movie's progress, and a series' under show_progress.
		expect(
			positionOf({
				type: "MEDIA_DATA",
				data: { "597": { type: "movie", progress: { watched: 3706.9, duration: 1 } } },
			}),
		).toBe(3706.9);
		expect(
			positionOf({
				type: "MEDIA_DATA",
				data: { "1399": { type: "tv", show_progress: { s1e1: { progress: { watched: 0.58, duration: 1 } } } } },
			}),
		).toBe(0.58);
		expect(positionOf("__yminfo")).toBeNull();
		expect(positionOf({ type: "ready" })).toBeNull();
		expect(positionOf({ position: -1 })).toBeNull();
		expect(positionOf({ a: { b: { c: { d: { e: { f: { g: { position: 1 } } } } } } } })).toBeNull();
	});

	it("frames the player with the watch page's attributes, its address escaped", () => {
		const page = probePage('https://player.example/movie/1?a=1&b="x"');
		expect(page).toContain('src="https://player.example/movie/1?a=1&amp;b=&quot;x&quot;"');
		expect(page).toContain('allow="autoplay; encrypted-media; fullscreen; picture-in-picture"');
		expect(page).not.toContain("sandbox");
	});
});
