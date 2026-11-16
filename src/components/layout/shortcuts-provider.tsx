import { HotkeysProvider } from "@tanstack/react-hotkeys";
import type { ReactNode } from "react";

/**
 * The app's defaults for every keyboard shortcut (`useShortcuts`, decision 0299), set once
 * at the root:
 * - a key press another handler already took (`preventDefault()`: a field's Enter, a menu's
 *   arrow keys, a dialog's Escape) is left alone;
 * - the event keeps travelling, so a listener further out still sees it.
 *
 * Two mounted components must not bind one key: both would answer. The package's default
 * warns in the console when that happens, and the browser review fails on a console message.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
	return (
		<HotkeysProvider defaultOptions={{ hotkey: { ignoreDefaultPrevented: true, stopPropagation: false } }}>
			{children}
		</HotkeysProvider>
	);
}
