import type { ChaalColor } from "../live/events";
import type { StudyChapterSummary } from "./schema";

/**
 * A study as Lichess exports it (PLAN Task 83, decision 0273): one PGN, a game per chapter,
 * each with the study's and the chapter's names and the chapter's address in its tags
 * (`StudyName`, `ChapterName`, `ChapterURL`, `Orientation`, `ChapterMode`). Pure: the server
 * reads a study with it, and the tests do.
 */

/** A study's chapter with its PGN, as the server keeps it. */
export type StudyChapter = StudyChapterSummary & { pgn: string };

export type ReadStudy = { name: string; chapters: StudyChapter[] };

/** Each chapter's PGN: a new one starts at a line that opens with `[Event "` after a blank line. */
export function splitStudy(text: string): string[] {
	return text
		.replace(/\r\n/g, "\n")
		.split(/\n[ \t]*\n(?=\[Event ")/)
		.map((part) => part.trim())
		.filter((part) => part.startsWith("["));
}

/** A PGN's tags (its first lines of `[Key "Value"]`). */
export function tagsOf(pgn: string): Record<string, string> {
	const tags: Record<string, string> = {};
	for (const line of pgn.split("\n")) {
		const tag = /^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/.exec(line.trim());
		if (!tag) {
			if (line.trim()) break;
			continue;
		}
		const [, key, value] = tag;
		if (key) tags[key] = (value ?? "").replace(/\\(["\\])/g, "$1");
	}
	return tags;
}

/** The chapter's id from its address (`https://lichess.org/study/{study}/{chapter}`). */
export function chapterIdOf(tags: Record<string, string>): string | null {
	for (const value of [tags.ChapterURL, tags.Site]) {
		const match = value ? /\/study\/[A-Za-z0-9]{8}\/([A-Za-z0-9]{8})(?:[/?#]|$)/.exec(value) : null;
		if (match?.[1]) return match[1];
	}
	return null;
}

/** A study to open, from what a player pasted: its address on Lichess (with a chapter, maybe) or its id. */
export function studyAddress(text: string): { id: string; chapter: string | null } | null {
	const value = text.trim();
	if (/^[A-Za-z0-9]{8}$/.test(value)) return { id: value, chapter: null };
	const match =
		/^(?:https?:\/\/)?(?:www\.)?lichess\.org\/study\/([A-Za-z0-9]{8})(?:\/([A-Za-z0-9]{8}))?(?:[/?#].*)?$/.exec(value);
	return match?.[1] ? { id: match[1], chapter: match[2] ?? null } : null;
}

const RESULTS: Readonly<Record<string, string>> = { "1-0": "1-0", "0-1": "0-1", "1/2-1/2": "½-½", "½-½": "½-½" };

/** A side's name, unless the chapter has none ("?"). */
const named = (value: string | undefined) => (value && value !== "?" ? value.slice(0, 80) : null);

/** A study's name and chapters; chapters without an address are dropped. */
export function readStudy(text: string): ReadStudy {
	let name = "";
	const chapters: StudyChapter[] = [];
	for (const pgn of splitStudy(text)) {
		const tags = tagsOf(pgn);
		const id = chapterIdOf(tags);
		if (!id || chapters.some((chapter) => chapter.id === id)) continue;
		name ||= tags.StudyName ?? "";
		const orientation: ChaalColor = tags.Orientation === "black" ? "black" : "white";
		chapters.push({
			id,
			name: (tags.ChapterName ?? tags.Event ?? "").slice(0, 200) || id,
			white: named(tags.White),
			black: named(tags.Black),
			result: RESULTS[tags.Result ?? ""] ?? null,
			orientation,
			gamebook: tags.ChapterMode === "gamebook",
			pgn,
		});
	}
	return { name: name.slice(0, 200), chapters };
}
