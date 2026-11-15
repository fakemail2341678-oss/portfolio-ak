/**
 * What Chaal's streams carry (src/server/routes/chaal-stream.ts): Lichess's events, a game's
 * lines and a kept-open challenge's, mapped to lean shapes on the server
 * (src/server/chaal/lichess/schemas.ts), one JSON object per line. Unknown types are
 * dropped there; an empty line is a keepalive.
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

/** Ours, not Lichess's: the stream closes on purpose before the function's time limit runs out; reconnect at once. */
export type ChaalReconnect = { type: "reconnect"; afterMs: number };

export type ChaalEvent =
	| { type: "gameStart" | "gameFinish"; game: ChaalEventGame }
	| { type: "challenge" | "challengeCanceled" | "challengeDeclined"; challenge: ChaalEventChallenge }
	| ChaalReconnect;

// --- A game's stream (GET /api/chaal/stream/game/{id}, Task 77) ----------------------------

/** A player in a game's stream: a Lichess account, or the Lichess AI (`aiLevel`, no id). */
export type ChaalGamePlayer = {
	id: string | null;
	name: string;
	title: string | null;
	rating: number | null;
	provisional: boolean;
	aiLevel: number | null;
	/** Once a rated game has ended. */
	ratingDiff: number | null;
};

/** What changes during a game: Lichess's `gameState`. Times are milliseconds. */
export type ChaalGameState = {
	/** Every move so far, in UCI. */
	moves: string[];
	wtime: number;
	btime: number;
	winc: number;
	binc: number;
	/** Lichess's status name: `started`, then how it ended (`mate`, `resign`, `outoftime`, `draw`, `aborted`…). */
	status: string;
	winner: ChaalColor | null;
	/** Standing offers: a draw or a takeback, by side. */
	wdraw: boolean;
	bdraw: boolean;
	wtakeback: boolean;
	btakeback: boolean;
	/** Before both sides have moved: the time each has for a first move before the game is aborted. */
	expiration: { idleMillis: number; millisToMove: number } | null;
};

/** What doesn't change during a game, with its state when the stream opened: Lichess's `gameFull`. */
export type ChaalGameFull = {
	id: string;
	rated: boolean;
	speed: string;
	variant: string;
	/** Start and increment in milliseconds; null for correspondence. */
	clock: { initial: number; increment: number } | null;
	daysPerTurn: number | null;
	/** The start position; null for the usual one. */
	initialFen: string | null;
	white: ChaalGamePlayer;
	black: ChaalGamePlayer;
	state: ChaalGameState;
	tournamentId: string | null;
	createdAt: number;
};

export type ChaalChatLine = { room: "player" | "spectator"; username: string; text: string };

export type ChaalGameLine =
	| { type: "gameFull"; game: ChaalGameFull }
	| { type: "gameState"; state: ChaalGameState }
	| ({ type: "chatLine" } & ChaalChatLine)
	/** The opponent left (or came back), and the seconds until a win or a draw may be claimed. */
	| { type: "opponentGone"; gone: boolean; claimWinInSeconds: number | null }
	| ChaalReconnect;

// --- A real-time challenge kept open (POST /api/chaal/stream/challenge, Task 77) ------------

/** How a challenge Lichess kept alive ended (its `{"done": …}` line). */
export type ChallengeDone = "accepted" | "declined" | "canceled";

export type ChaalChallengeLine =
	| { type: "challenge"; challenge: ChaalEventChallenge }
	| { type: "done"; done: ChallengeDone }
	/** Ours: nobody answered while the stream could stay open; the challenge was cancelled. */
	| { type: "expired" };

// --- A seek in the lobby (POST /api/chaal/stream/seek, Task 78) -----------------------------

/**
 * Lichess sends a seek's stream nothing but keepalives, and closes it when someone accepts
 * it (the game arrives on the event stream) or it expires. Ours: `ended` when Lichess closed
 * it; `reconnect` when our window ran out or the stream broke, and the seek goes on in a new one.
 */
export type ChaalSeekLine = { type: "ended" } | ChaalReconnect;
