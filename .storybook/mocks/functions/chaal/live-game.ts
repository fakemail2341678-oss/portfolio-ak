import { fn } from "storybook/test";
import type { ChaalChatLine } from "../../../../src/features/chaal/live/events";
import type { ChaalLiveGame } from "../../../../src/features/chaal/play/schema";

// Stand-ins for src/functions/chaal/live-game.ts.
export const SAMPLE_LIVE_GAME: ChaalLiveGame = {
	color: "white",
	game: {
		id: "kUhShhgl",
		rated: true,
		speed: "rapid",
		variant: "standard",
		clock: { initial: 600_000, increment: 5_000 },
		daysPerTurn: null,
		initialFen: null,
		white: {
			id: "e2e_player",
			name: "E2E_Player",
			title: null,
			rating: 1603,
			provisional: false,
			aiLevel: null,
			ratingDiff: null,
		},
		black: {
			id: "e2e_rival",
			name: "E2E_Rival",
			title: "FM",
			rating: 2210,
			provisional: false,
			aiLevel: null,
			ratingDiff: null,
		},
		state: {
			moves: ["e2e4", "c7c5", "g1f3", "d7d6"],
			wtime: 512_000,
			btime: 498_000,
			winc: 5_000,
			binc: 5_000,
			status: "started",
			winner: null,
			wdraw: false,
			bdraw: false,
			wtakeback: false,
			btakeback: false,
			expiration: null,
		},
		tournamentId: null,
		createdAt: 1_762_600_000_000,
	},
};

export const getChaalLiveGame = fn(async (): Promise<ChaalLiveGame> => SAMPLE_LIVE_GAME).mockName("getChaalLiveGame");
export const playChaalMove = fn(async (): Promise<void> => {}).mockName("playChaalMove");
export const actOnChaalGame = fn(async (): Promise<void> => {}).mockName("actOnChaalGame");
export const getChaalChat = fn(
	async (): Promise<ChaalChatLine[]> => [{ room: "player", username: "E2E_Rival", text: "Good luck!" }],
).mockName("getChaalChat");
export const sendChaalChat = fn(async (): Promise<void> => {}).mockName("sendChaalChat");
