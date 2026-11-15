import type { PuzzlesSearch } from "../../search";
import type { PuzzleBatchInput } from "../schema";
import { isPuzzleAngle, type PuzzleAngle } from "./angles";

/** The theme a URL names, when Chaal knows it; else a mix. */
export const angleOf = (theme: string | undefined): PuzzleAngle => (theme && isPuzzleAngle(theme) ? theme : "mix");

/** Training's choice from the URL: the loader and the page ask for the same first batch. */
export const trainingInput = (search: PuzzlesSearch): Omit<PuzzleBatchInput, "round"> => ({
	angle: angleOf(search.theme),
	difficulty: search.difficulty,
	color: search.color,
	streak: false,
});
