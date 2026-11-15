import { type RefObject, useEffect } from "react";

/** A click inside the player arms the guard this long. */
const GUARD_MS = 5_000;

/**
 * The redirect guard (PLAN 12.5): a window `blur` while the iframe has focus means a click
 * inside the player. For the next 5 s `beforeunload` is armed, so a redirect from that click
 * asks before leaving. At any other time, closing the tab doesn't prompt.
 */
export function useRedirectGuard(frameRef: RefObject<HTMLIFrameElement | null>, onPlayerClick?: () => void) {
	useEffect(() => {
		let guardUntil = 0;
		const onBlur = () => {
			if (!frameRef.current || document.activeElement !== frameRef.current) return;
			guardUntil = Date.now() + GUARD_MS;
			onPlayerClick?.();
		};
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (Date.now() > guardUntil) return;
			event.preventDefault();
			// Older browsers need a value to ask.
			event.returnValue = "";
		};
		window.addEventListener("blur", onBlur);
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => {
			window.removeEventListener("blur", onBlur);
			window.removeEventListener("beforeunload", onBeforeUnload);
		};
	}, [frameRef, onPlayerClick]);
}
