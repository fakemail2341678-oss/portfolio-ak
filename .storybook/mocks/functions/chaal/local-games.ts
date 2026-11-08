import { fn } from "storybook/test";
import { newLocalGame, toRecord } from "../../../../src/features/chaal/local/game";
import type { LocalGameSummary } from "../../../../src/features/chaal/local/schema";
import type { LocalGameRecord } from "../../../../src/features/chaal/local/types";

// Stand-ins for src/functions/chaal/local-games.ts.
const AT = new Date("2026-11-08T09:00:00.000Z");
const PLAYING = toRecord(
	newLocalGame(
		{ mode: "engine", level: 4, color: "white", clock: { initial: 600, increment: 0 } },
		"8b1c2d3e-4f5a-4b6c-9d7e-0f1a2b3c4d5e",
		AT,
	),
);

const summary = (record: LocalGameRecord, moves: number): LocalGameSummary => {
	const { pgn: _pgn, ...rest } = record;
	return { ...rest, moves };
};

export const listChaalLocalGames = fn(async (): Promise<LocalGameSummary[]> => [summary(PLAYING, 0)]).mockName(
	"listChaalLocalGames",
);
export const getChaalLocalGame = fn(async (): Promise<LocalGameRecord> => PLAYING).mockName("getChaalLocalGame");
export const saveChaalLocalGame = fn(
	async ({ data }: { data: { game: LocalGameRecord } }): Promise<LocalGameSummary> => summary(data.game, 0),
).mockName("saveChaalLocalGame");
export const deleteChaalLocalGame = fn(async (): Promise<void> => {}).mockName("deleteChaalLocalGame");
export const importChaalLocalGames = fn(
	async ({ data }: { data: { games: LocalGameRecord[] } }): Promise<{ imported: string[] }> => ({
		imported: data.games.map((game) => game.id),
	}),
).mockName("importChaalLocalGames");
