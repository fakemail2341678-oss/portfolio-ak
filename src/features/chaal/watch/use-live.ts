import { type RefObject, useEffect, useEffectEvent, useState } from "react";
import { type KeepOptions, keepStreaming, type StreamStatus } from "../live/reader";

/**
 * Lichess's public live data, read by the browser (PLAN 13.5, "Public live data"; decision
 * 0272): a stream kept open while the page wants it, with its state for the page's dot.
 * Each open restates what the stream is about (a TV game, a game's positions, a round's
 * boards), so a reconnect loses nothing.
 */

export type LiveLink = "connecting" | "open" | "waiting" | "refused" | "closed";

/** Lichess's public streams send no keepalives: a TV game can go a minute without a move. */
export const PUBLIC_SILENCE_MS = 5 * 60_000;

type PublicStreamOptions = Pick<KeepOptions, "split" | "parse" | "silenceMs" | "reopenWhenClosed"> & {
	accept?: string;
	/** For stories and tests: how the stream is kept (the real one by default). */
	keep?: typeof keepStreaming;
};

/** Keeps `url` open while it's set (null closes it); each line goes to the latest `onLine`. */
export function usePublicStream(
	url: string | null,
	onLine: (value: unknown) => void,
	options: PublicStreamOptions = {},
): LiveLink {
	const handleLine = useEffectEvent(onLine);
	const optionsNow = useEffectEvent(() => options);
	const [link, setLink] = useState<LiveLink>("connecting");
	useEffect(() => {
		if (!url) return;
		const { accept = "application/x-ndjson", keep = keepStreaming, ...read } = optionsNow();
		setLink("connecting");
		const kept = keep(url, {
			silenceMs: PUBLIC_SILENCE_MS,
			reopenWhenClosed: true,
			...read,
			init: { headers: { accept } },
			onLine: (value) => handleLine(value),
			onStatus: (status: StreamStatus) => setLink(status.state),
		});
		return () => kept.stop();
	}, [url]);
	return link;
}

/** Whether the page is shown: a hidden tab closes its streams, and they restate when it's back. */
export function usePageVisible(): boolean {
	const [visible, setVisible] = useState(true);
	useEffect(() => {
		const update = () => setVisible(document.visibilityState !== "hidden");
		update();
		document.addEventListener("visibilitychange", update);
		return () => document.removeEventListener("visibilitychange", update);
	}, []);
	return visible;
}

/**
 * Whether an element is on screen (or near it): the TV grid opens a channel's feed only
 * while its card can be seen, so a phone reads one or two, not eight.
 */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
	const [shown, setShown] = useState(false);
	useEffect(() => {
		const element = ref.current;
		if (!element || typeof IntersectionObserver === "undefined") {
			setShown(true);
			return;
		}
		const observer = new IntersectionObserver((entries) => setShown(entries.some((entry) => entry.isIntersecting)), {
			rootMargin: "100px",
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return shown;
}
