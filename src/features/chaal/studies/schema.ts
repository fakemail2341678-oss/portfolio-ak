import { z } from "zod";
import { PGN_MAX_BYTES } from "../chess/pgn";
import { LICHESS_USERNAME } from "../community/limits";
import type { ChaalColor } from "../live/events";

/**
 * Studies (PLAN Task 83, decision 0273): what the functions take and give. Lichess sends a
 * study as one PGN with a game per chapter; the server keeps the whole and sends a page its
 * chapters' list and the chapter shown. Comments and names are shown as text.
 */

export const studyId = z.string().regex(/^[A-Za-z0-9]{8}$/);

export const studiesByInput = z.strictObject({ username: z.string().regex(LICHESS_USERNAME) });
export const studyInput = z.strictObject({ id: studyId });
export const studyChapterInput = z.strictObject({ id: studyId, chapter: studyId });

/** "Save to study": the analysis board's PGN as a new chapter of one of the player's studies. */
export const STUDY_CHAPTER_NAME_MAX = 80;
export const saveToStudyInput = z.strictObject({
	study: studyId,
	name: z.string().trim().min(1).max(STUDY_CHAPTER_NAME_MAX),
	pgn: z.string().min(1).max(PGN_MAX_BYTES),
	orientation: z.enum(["white", "black"]),
});
export type SaveToStudyInput = z.output<typeof saveToStudyInput>;

/** How many of an account's studies a list shows (Lichess sends them all). */
export const STUDIES_SHOWN = 100;

export type StudySummary = { id: string; name: string; createdAt: number | null; updatedAt: number | null };

export type ChaalStudyList = { by: string; studies: StudySummary[] };

export type StudyChapterSummary = {
	id: string;
	name: string;
	white: string | null;
	black: string | null;
	/** "1-0", "0-1", "½-½", or null while there's none. */
	result: string | null;
	orientation: ChaalColor;
	/** An interactive lesson on Lichess (gamebook): shown here as its moves and comments. */
	gamebook: boolean;
};

export type ChaalStudy = { id: string; name: string; chapters: StudyChapterSummary[]; url: string };

/** One chapter's PGN (its moves, variations, comments and arrows), for the viewer. */
export type ChaalStudyChapter = { id: string; chapter: string; pgn: string };

/** What saving answered: the study and its new chapter, to open. */
export type SavedToStudy = { study: string; chapter: string | null };
