import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { m } from "@/paraglide/messages";
import { isPromotion, type MoveInput, type PlayedMove, play } from "../chess/rules";
import type { ChaalGameLine } from "../live/events";
import { type KeepOptions, keepStreaming, type StreamStatus } from "../live/reader";
import type { GameAction } from "../play/schema";
import { applyLine, fenOf, isOver, type LiveGame, type LiveMove, myTurn, rollback, withPending } from "./live-game";

/** A premove as the board gives it: two squares (a pawn reaching the last rank becomes a queen). */
export type Premove = MoveInput;

/** Where the game's stream stands: the page's dot, and its banner after 3 s without one. */
export type GameLink = "connecting" | "open" | "offline" | "refused";

export type LiveCalls = {
	move: (id: string, uci: string) => Promise<void>;
	act: (id: string, action: GameAction) => Promise<void>;
	chat: (id: string, text: string) => Promise<void>;
};

export type LiveGameView = {
	game: LiveGame;
	link: GameLink;
	/** Since when the stream has been down (Date.now()), for the 3 s banner. */
	downSince: number | null;
	premove: Premove | null;
	setPremove: (premove: Premove | null) => void;
	/** The board's played move: shown at once, sent to Lichess, taken back if refused. */
	move: (played: PlayedMove) => void;
	act: (action: GameAction) => Promise<boolean>;
	sendChat: (text: string) => Promise<boolean>;
	/** Whether the player went berserk in this arena game (Task 78): the button goes. */
	berserked: boolean;
	berserk: () => Promise<boolean>;
};

export const gameStreamUrl = (id: string) => `/api/chaal/stream/game/${id}`;

const monotonic = () => (typeof performance === "undefined" ? 0 : performance.now());

/**
 * Plays a Lichess game in the page (decision 0266): reads its stream through our server
 * (reconnecting as needed: each open restates the game), shows the player's move within the
 * frame and sends it on the play lane, rolls it back when Lichess refuses it, plays one
 * premove when the turn comes, and stops reading when the game is over.
 */
export function useLiveGame({
	initial,
	calls,
	stream = keepStreaming,
}: {
	initial: LiveGame;
	calls: LiveCalls;
	/** Tests and stories pass their own stream. */
	stream?: (url: string, options: KeepOptions) => { stop: () => void };
}): LiveGameView {
	const [game, setGame] = useState(initial);
	const [link, setLink] = useState<GameLink>("connecting");
	const [downSince, setDownSince] = useState<number | null>(null);
	const [premove, setPremove] = useState<Premove | null>(null);
	const [berserked, setBerserked] = useState(false);
	const latest = useRef(game);
	latest.current = game;
	const id = initial.full.id;
	const over = isOver(game.state.status);

	useEffect(() => {
		if (over) {
			setLink("open");
			setDownSince(null);
			return;
		}
		const onStatus = (status: StreamStatus) => {
			const next: GameLink =
				status.state === "open"
					? "open"
					: status.state === "refused"
						? "refused"
						: status.state === "waiting"
							? "offline"
							: "connecting";
			setLink((previous) => (next === "connecting" && previous === "offline" ? "offline" : next));
			setDownSince((since) => (next === "open" ? null : (since ?? Date.now())));
		};
		const kept = stream(gameStreamUrl(id), {
			reopenWhenClosed: true,
			onStatus,
			onLine: (value) => setGame((current) => applyLine(current, value as ChaalGameLine, monotonic())),
		});
		return () => kept.stop();
	}, [id, over, stream]);

	const send = (played: LiveMove) => {
		setGame((current) => withPending(current, played, monotonic()));
		calls.move(id, played.uci).catch((error: unknown) => {
			setGame(rollback);
			toast.error(m.ch_live_move_refused(), { description: errorMessage(error) });
		});
	};

	// `send` is made each render; the effect below reads the latest through a ref.
	const sending = useRef(send);
	sending.current = send;

	// One premove: played as soon as the turn comes, if it's still legal then.
	useEffect(() => {
		if (!premove || !myTurn(game)) return;
		setPremove(null);
		const fen = fenOf(game);
		const played = play(
			fen,
			isPromotion(fen, premove.from, premove.to) ? { ...premove, promotion: premove.promotion ?? "q" } : premove,
		);
		if (played) sending.current({ uci: played.uci, san: played.san, fen: played.fen });
	}, [game, premove]);

	const act = async (action: GameAction) => {
		try {
			await calls.act(id, action);
			return true;
		} catch (error) {
			toast.error(errorMessage(error));
			return false;
		}
	};

	return {
		game,
		link,
		downSince,
		premove,
		setPremove,
		move: (played) => {
			if (!myTurn(latest.current)) return;
			send({ uci: played.uci, san: played.san, fen: played.fen });
		},
		act,
		berserked,
		berserk: async () => {
			const done = await act("berserk");
			if (done) setBerserked(true);
			return done;
		},
		sendChat: async (text) => {
			try {
				await calls.chat(id, text);
				return true;
			} catch (error) {
				toast.error(errorMessage(error));
				return false;
			}
		},
	};
}
