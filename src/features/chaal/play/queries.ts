import { queryOptions } from "@tanstack/react-query";
import {
	acceptChaalChallenge,
	cancelChaalChallenge,
	challengeChaalAi,
	challengeChaalPlayer,
	declineChaalChallenge,
	getChaalChallenges,
	getChaalPlaying,
	openChaalChallenge,
	seekChaalCorrespondence,
} from "@/functions/chaal/challenges";
import {
	actOnChaalGame,
	getChaalChat,
	getChaalLiveGame,
	playChaalMove,
	sendChaalChat,
} from "@/functions/chaal/live-game";
import { chaalKeys } from "../keys";
import type {
	ChallengeAiInput,
	ChallengePlayerInput,
	DeclineReason,
	GameAction,
	OpenChallengeInput,
	SeekInput,
} from "./schema";

/**
 * Online play's reads and writes (Task 77). The play hub's loader ensures the challenges
 * for a connected player; the event stream keeps them current after that. A game's page
 * ensures its game; its stream keeps it current.
 */

export const challengesQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.challenges(), queryFn: () => getChaalChallenges(), retry: false });

export const liveGameQueryOptions = (id: string) =>
	queryOptions({
		queryKey: chaalKeys.liveGame(id),
		queryFn: () => getChaalLiveGame({ data: { id } }),
		// The stream carries the game after its first paint.
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});

export const chatQueryOptions = (id: string) =>
	queryOptions({
		queryKey: chaalKeys.chat(id),
		queryFn: () => getChaalChat({ data: { id } }),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});

/** The calls a game's page and the hub make; a test or a story passes its own. */
export const playCalls = {
	move: (id: string, uci: string) => playChaalMove({ data: { id, uci } }),
	act: (id: string, action: GameAction) => actOnChaalGame({ data: { id, action } }),
	chat: (id: string, text: string) => sendChaalChat({ data: { id, text } }),
	challengeAi: (input: ChallengeAiInput) => challengeChaalAi({ data: input }),
	challengePlayer: (input: ChallengePlayerInput) => challengeChaalPlayer({ data: input }),
	open: (input: OpenChallengeInput) => openChaalChallenge({ data: input }),
	accept: (id: string) => acceptChaalChallenge({ data: { id } }),
	decline: (id: string, reason: DeclineReason) => declineChaalChallenge({ data: { id, reason } }),
	cancel: (id: string) => cancelChaalChallenge({ data: { id } }),
	/** A correspondence seek (Task 78); a clock's goes through the seek stream. */
	seekDays: (input: SeekInput) => seekChaalCorrespondence({ data: input }),
	playing: () => getChaalPlaying(),
};
export type PlayCalls = typeof playCalls;
