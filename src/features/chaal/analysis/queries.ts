import { mutationOptions, queryOptions } from "@tanstack/react-query";
import {
	deleteChaalAnalysis,
	getChaalAnalysis,
	listChaalAnalyses,
	saveChaalAnalysis,
} from "@/functions/chaal/analyses";
import { getChaalCloudEval, getChaalExplorer, getChaalTablebase, importChaalGame } from "@/functions/chaal/analysis";
import { chaalKeys } from "../keys";
import type { ExplorerDatabase, ExplorerRating, ExplorerSpeed } from "../schema";
import type { AnalysisInput } from "./schema";

/**
 * The analysis board's reads (Task 75): Lichess's data by position, kept for the visit
 * (a position's answer doesn't change while the page is open), and "My analyses". The
 * route's loader ensures a saved analysis it opens; the rest load as the board moves.
 */

const FOR_THE_VISIT = { staleTime: Number.POSITIVE_INFINITY, gcTime: 10 * 60_000, retry: false } as const;

export const cloudEvalQueryOptions = (fen: string, multiPv: number) =>
	queryOptions({
		queryKey: chaalKeys.cloudEval(fen, multiPv),
		queryFn: () => getChaalCloudEval({ data: { fen, multiPv } }),
		...FOR_THE_VISIT,
	});

export type ExplorerQuery = {
	database: ExplorerDatabase;
	fen: string;
	speeds?: ExplorerSpeed[];
	ratings?: ExplorerRating[];
	player?: string;
	color?: "white" | "black";
};

export const explorerQueryOptions = (query: ExplorerQuery) =>
	queryOptions({
		queryKey: chaalKeys.explorer(query),
		queryFn: () => getChaalExplorer({ data: query }),
		...FOR_THE_VISIT,
		// A player still being indexed: ask again shortly for more games.
		refetchInterval: (state) => (state.state.data?.ok && state.state.data.data.indexing ? 5_000 : false),
	});

export const tablebaseQueryOptions = (fen: string) =>
	queryOptions({
		queryKey: chaalKeys.tablebase(fen),
		queryFn: () => getChaalTablebase({ data: { fen } }),
		...FOR_THE_VISIT,
	});

/** A finished Lichess game, for "Import" (not cached: it's read once). */
export const importLichessGame = (id: string) => importChaalGame({ data: { id } });

export const analysesQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.analyses(), queryFn: () => listChaalAnalyses() });

export const analysisQueryOptions = (id: string) =>
	// A missing analysis stays missing: no retries.
	queryOptions({ queryKey: chaalKeys.analysis(id), queryFn: () => getChaalAnalysis({ data: { id } }), retry: false });

export const saveAnalysisMutationOptions = () =>
	mutationOptions({
		mutationKey: [...chaalKeys.analyses(), "save"],
		mutationFn: (input: AnalysisInput) => saveChaalAnalysis({ data: input }),
	});

export const deleteAnalysisMutationOptions = () =>
	mutationOptions({
		mutationKey: [...chaalKeys.analyses(), "delete"],
		mutationFn: (id: string) => deleteChaalAnalysis({ data: { id } }),
	});
