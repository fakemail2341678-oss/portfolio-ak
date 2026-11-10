import { fn } from "storybook/test";
import type { SavedToStudy, StudySummary } from "../../../../src/features/chaal/studies/schema";
import { studyList } from "./studies";

// Stand-ins for src/functions/chaal/my-studies.ts: the player's two studies; saving answers with a new chapter.
export const getChaalMyStudies = fn(async (): Promise<StudySummary[]> => studyList.studies).mockName(
	"getChaalMyStudies",
);
export const saveChaalToStudy = fn(
	async (): Promise<SavedToStudy> => ({ study: "studyNp1", chapter: "chapNew1" }),
).mockName("saveChaalToStudy");
