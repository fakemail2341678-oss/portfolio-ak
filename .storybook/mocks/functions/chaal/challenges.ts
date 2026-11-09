import { fn } from "storybook/test";
import type { ChaalEventChallenge } from "../../../../src/features/chaal/live/events";
import type {
	ChaalChallenges,
	ChaalOpenChallenge,
	ChaalPlaying,
	ChaalSeek,
} from "../../../../src/features/chaal/play/schema";

// Stand-ins for src/functions/chaal/challenges.ts.
export const SAMPLE_CHALLENGE: ChaalEventChallenge = {
	id: "qUfdwN17",
	status: "created",
	challenger: { id: "e2e_rival", name: "E2E_Rival", title: "FM", rating: 2210, aiLevel: null },
	destUser: { id: "e2e_player", name: "E2E_Player", title: null, rating: 1603, aiLevel: null },
	variant: "standard",
	rated: false,
	speed: "rapid",
	timeControl: { type: "clock", limit: 600, increment: 5, daysPerTurn: null },
	color: "random",
	finalColor: "black",
	declineReasonKey: null,
};

export const getChaalChallenges = fn(
	async (): Promise<ChaalChallenges> => ({ incoming: [SAMPLE_CHALLENGE], outgoing: [] }),
).mockName("getChaalChallenges");
export const challengeChaalPlayer = fn(async (): Promise<ChaalEventChallenge> => SAMPLE_CHALLENGE).mockName(
	"challengeChaalPlayer",
);
export const openChaalChallenge = fn(
	async (): Promise<ChaalOpenChallenge> => ({
		id: "open1234",
		link: "https://lichess.org/open1234?color=black",
		color: "white",
	}),
).mockName("openChaalChallenge");
export const acceptChaalChallenge = fn(async ({ data }: { data: { id: string } }) => ({ id: data.id })).mockName(
	"acceptChaalChallenge",
);
export const declineChaalChallenge = fn(async (): Promise<void> => {}).mockName("declineChaalChallenge");
export const cancelChaalChallenge = fn(async (): Promise<void> => {}).mockName("cancelChaalChallenge");
export const challengeChaalAi = fn(async () => ({ id: "aiGame12" })).mockName("challengeChaalAi");
export const seekChaalCorrespondence = fn(async (): Promise<ChaalSeek> => ({ id: "seek1234" })).mockName(
	"seekChaalCorrespondence",
);
export const getChaalPlaying = fn(async (): Promise<ChaalPlaying> => ({ games: [] })).mockName("getChaalPlaying");
