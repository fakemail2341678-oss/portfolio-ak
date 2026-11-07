import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Picture-in-picture for a framed player (decision 0248). A page can't put a cross-origin
 * frame's <video> in picture-in-picture, so this opens a Document Picture-in-Picture window
 * (Chromium on desktop) and the page renders the player there. Moving a frame to another
 * document reloads it: a `param` player gets the current position as its start, and a
 * `self` player (Viduki) resumes from its own memory, as on any reload.
 */

type DocumentPictureInPicture = {
	requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
	window: Window | null;
};

const api = (): DocumentPictureInPicture | undefined =>
	(window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

const never = () => () => {};

export function usePictureInPicture() {
	// The server renders the button, so the bar never changes size; a browser without the API disables it.
	const supported = useSyncExternalStore(
		never,
		() => api() !== undefined,
		() => true,
	);
	const [host, setHost] = useState<Window | null>(null);

	useEffect(() => () => host?.close(), [host]);

	/** `onClose` runs when the viewer closes the window, before the page takes the player back. */
	const open = async (size: { width: number; height: number }, onClose: () => void) => {
		const pip = api();
		if (!pip || host) return;
		try {
			const opened = await pip.requestWindow({
				width: Math.max(320, Math.round(size.width / 2)),
				height: Math.max(180, Math.round(size.height / 2)),
			});
			// Set through the CSSOM: the policy forbids style attributes, not this.
			opened.document.body.style.margin = "0";
			opened.document.body.style.background = "#000";
			opened.document.title = document.title;
			opened.addEventListener(
				"pagehide",
				() => {
					onClose();
					setHost(null);
				},
				{ once: true },
			);
			setHost(opened);
		} catch {
			// The viewer's browser refused (no user gesture, or one window already open).
		}
	};

	return { supported, host, open, close: () => host?.close() };
}
