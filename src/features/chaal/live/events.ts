/**
 * What Chaal's event stream carries (src/server/routes/chaal-stream.ts): Lichess's events,
 * mapped to lean shapes on the server (src/server/chaal/lichess/schemas.ts), one JSON object
 * per line. Unknown event types are dropped there; an empty line is a keepalive.
 */

export type ChaalColor = "white" | "black";

export type ChaalEventPlayer = {
	/** Lichess's lowercase id; null for the Lichess AI. */
	id: string | null;
	name: string;
	title: string | null;
	rating: number | null;
	/** The Lichess AI's level (1–8) when the opponent is the AI. */
	aiLevel: number | null;
};

export type ChaalEventGame = {
	id: string;
	color: ChaalColor;
	fen: string;
	lastMove: string;
	source: string;
	status: string;
	variant: string;
	speed: string;
	rated: boolean;
	hasMoved: boolean;
	isMyTurn: boolean;
	secondsLeft: number | null;
	opponent: ChaalEventPlayer;
	winner: ChaalColor | null;
	ratingDiff: number | null;
	/** Whether the Board API can play it (Lichess's `compat.board`). */
	boardCompatible: boolean;
	tournamentId: string | null;
};

export type ChaalEventChallenge = {
	id: string;
	status: string;
	challenger: ChaalEventPlayer | null;
	destUser: ChaalEventPlayer | null;
	variant: string;
	rated: boolean;
	speed: string;
	timeControl: { type: string; limit: number | null; increment: number | null; daysPerTurn: number | null };
	color: string;
	finalColor: ChaalColor | null;
	declineReasonKey: string | null;
};

export type ChaalEvent =
	| { type: "gameStart" | "gameFinish"; game: ChaalEventGame }
	| { type: "challenge" | "challengeCanceled" | "challengeDeclined"; challenge: ChaalEventChallenge }
	/** Ours, not Lichess's: the stream closes on purpose before the function's time limit runs out; reconnect at once. */
	| { type: "reconnect"; afterMs: number };
