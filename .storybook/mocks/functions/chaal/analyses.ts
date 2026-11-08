import { fn } from "storybook/test";
import type {
	AnalysisInput,
	ChaalAnalysis,
	ChaalAnalysisSummary,
} from "../../../../src/features/chaal/analysis/schema";
import { createTree } from "../../../../src/features/chaal/chess/tree";

// Stand-ins for src/functions/chaal/analyses.ts.
const SAVED: ChaalAnalysisSummary = {
	id: "7d0c5e8a-1b2c-4d3e-8f90-123456789abc",
	title: "Ruy Lopez, Berlin",
	moves: 24,
	white: "E2E_Player",
	black: "E2E_Rival",
	updatedAt: "2026-11-08T09:00:00.000Z",
};

export const listChaalAnalyses = fn(async (): Promise<ChaalAnalysisSummary[]> => [SAVED]).mockName("listChaalAnalyses");
export const getChaalAnalysis = fn(
	async (): Promise<ChaalAnalysis> => ({
		id: SAVED.id,
		title: SAVED.title,
		tree: createTree(),
		tags: {},
		orientation: "white",
		updatedAt: SAVED.updatedAt,
	}),
).mockName("getChaalAnalysis");
export const saveChaalAnalysis = fn(
	async ({ data }: { data: AnalysisInput }): Promise<ChaalAnalysisSummary> => ({
		...SAVED,
		id: data.id ?? SAVED.id,
		title: data.title,
	}),
).mockName("saveChaalAnalysis");
export const deleteChaalAnalysis = fn(async (): Promise<void> => {}).mockName("deleteChaalAnalysis");
