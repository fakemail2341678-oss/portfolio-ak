import type { ChaalEventChallenge, ChaalEventGame } from "./events";
import { incomingChallenges, type LiveState } from "./store";

/**
 * What's worth telling the player as it happens (PLAN Task 78, decision 0267): a challenge
 * to them, their move in a correspondence game, a correspondence game that has started. Pure:
 * the frame compares the event store before and after each change and toasts what's new.
 *
 * Nothing is new while the stream restates what it holds (Lichess sends every current
 * challenge and game when it opens), nor in the first state after that: a reload never
 * repeats the notices. Real-time games aren't told: the page that started one opens it.
 */
export type LiveNotice =
	| { kind: "challenge"; challenge: ChaalEventChallenge }
	| { kind: "turn"; game: ChaalEventGame }
	| { kind: "started"; game: ChaalEventGame };

const correspondence = (game: ChaalEventGame) => game.speed === "correspondence";

export function newNotices(before: LiveState, after: LiveState, me: string | null): LiveNotice[] {
	if (!before.settled || !after.settled) return [];
	const notices: LiveNotice[] = [];
	const hadChallenge = new Set(before.challenges.map((challenge) => challenge.id));
	for (const challenge of incomingChallenges(after, me)) {
		if (!hadChallenge.has(challenge.id)) notices.push({ kind: "challenge", challenge });
	}
	const had = new Map(before.games.map((game) => [game.id, game]));
	for (const game of after.games) {
		if (!correspondence(game)) continue;
		const previous = had.get(game.id);
		if (!previous) notices.push({ kind: "started", game });
		else if (game.isMyTurn && !previous.isMyTurn) notices.push({ kind: "turn", game });
	}
	return notices;
}
