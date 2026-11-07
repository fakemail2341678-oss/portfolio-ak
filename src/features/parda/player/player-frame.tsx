import { type CSSProperties, type RefObject, useEffect } from "react";
import type { LabSandbox } from "../admin/schema";
import { acceptMessage } from "./adapters";
import type { PlayerAdapter, PlayerEvent, PlayerTarget } from "./adapters/types";

/** Never `allow-top-navigation`: a framed player can't send this page anywhere through a sandbox it asked for. */
const SANDBOX: Readonly<Record<Exclude<LabSandbox, "none">, string>> = {
	strict: "allow-scripts allow-same-origin",
	popups: "allow-scripts allow-same-origin allow-popups",
};

/**
 * A source's iframe and its messages (PLAN 12.5), through the source's adapter only.
 * A path plays on this app, so its messages come from the page's own origin. In a
 * picture-in-picture window the frame's parent is that window, so it listens there (`host`).
 */
export function PlayerFrame({
	url,
	origins,
	adapter,
	sandbox,
	title,
	frameRef,
	onEvent,
	target,
	host,
	style,
	className = "aspect-video w-[min(100%,calc((100dvh-10rem)*16/9))] rounded-md border bg-black",
}: {
	url: string;
	origins: ReadonlyArray<string>;
	adapter: PlayerAdapter;
	sandbox: LabSandbox;
	title: string;
	frameRef: RefObject<HTMLIFrameElement | null>;
	onEvent: (event: PlayerEvent) => void;
	/** The title it shows: a provider that reports every title it remembers (`viduki`) needs it. */
	target: PlayerTarget | null;
	/** The window the frame lives in, when it isn't this page's (picture-in-picture). */
	host?: Window | null;
	/** Inline sizing, for a window without the app's stylesheets (picture-in-picture). */
	style?: CSSProperties;
	/** The lab's framed box by default; a title page fills its screen. */
	className?: string;
}) {
	useEffect(() => {
		const allowed = url.startsWith("/") ? [...origins, window.location.origin] : origins;
		const listen = (message: MessageEvent) => {
			const event = acceptMessage(message, {
				adapter,
				origins: allowed,
				frame: frameRef.current?.contentWindow ?? null,
				target,
			});
			if (event) onEvent(event);
		};
		const on = host ?? window;
		on.addEventListener("message", listen);
		return () => on.removeEventListener("message", listen);
	}, [url, origins, adapter, frameRef, onEvent, target, host]);

	return (
		<iframe
			ref={frameRef}
			src={url}
			title={title}
			allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
			referrerPolicy="origin"
			{...(sandbox === "none" ? {} : { sandbox: SANDBOX[sandbox] })}
			className={className}
			style={style}
		/>
	);
}
