import { fn } from "storybook/test";
import type {
	ChaalStudy,
	ChaalStudyChapter,
	ChaalStudyList,
	StudyChapterSummary,
} from "../../../../src/features/chaal/studies/schema";

// Stand-ins for src/functions/chaal/studies.ts: a made-up study of two chapters.

export const chapters: StudyChapterSummary[] = [
	{
		id: "chapItal",
		name: "The Italian: quiet lines",
		white: null,
		black: null,
		result: null,
		orientation: "white",
		gamebook: false,
	},
	{
		id: "chapFork",
		name: "Find the fork",
		white: null,
		black: null,
		result: null,
		orientation: "black",
		gamebook: true,
	},
];

export const studyPgn = `[Event "Openings for club players: The Italian: quiet lines"]
[Site "https://lichess.org/study/studyNp1/chapItal"]
[Result "*"]
[StudyName "Openings for club players"]
[ChapterName "The Italian: quiet lines"]
[ChapterURL "https://lichess.org/study/studyNp1/chapItal"]
[Orientation "white"]

{ The Italian starts with a bishop aimed at f7. } 1. e4 e5 2. Nf3 Nc6 3. Bc4 { [%cal Gc4f7] Eyes on f7. } 3... Bc5 (3... Nf6 { The Two Knights. } 4. d3) 4. c3 Nf6 5. d3 { The quiet way: slow, solid, and full of plans. } *`;

export const study: ChaalStudy = {
	id: "studyNp1",
	name: "Openings for club players",
	chapters,
	url: "https://lichess.org/study/studyNp1",
};

export const studyList: ChaalStudyList = {
	by: "lichess",
	studies: [
		{
			id: "studyNp1",
			name: "Openings for club players",
			createdAt: Date.UTC(2026, 8, 1),
			updatedAt: Date.UTC(2026, 10, 2),
		},
		{
			id: "studyNp2",
			name: "Rook endings you must know",
			createdAt: Date.UTC(2026, 6, 1),
			updatedAt: Date.UTC(2026, 9, 20),
		},
	],
};

export const getChaalStudiesBy = fn(async (): Promise<ChaalStudyList> => studyList).mockName("getChaalStudiesBy");
export const getChaalStudy = fn(async (): Promise<ChaalStudy> => study).mockName("getChaalStudy");
export const getChaalStudyChapter = fn(
	async (): Promise<ChaalStudyChapter> => ({ id: "studyNp1", chapter: "chapItal", pgn: studyPgn }),
).mockName("getChaalStudyChapter");
