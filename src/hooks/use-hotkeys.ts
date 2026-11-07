import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Keyboard shortcuts. A combo is "+"-separated modifiers and one key, e.g. "mod+k",
 * "mod+s", "shift+?", "escape". `mod` is ⌘ on Apple devices and Ctrl elsewhere
 * (both are accepted everywhere, so a Mac keyboard on Windows still works).
 *
 *   useHotkeys({ "mod+k": () => setOpen(true) });
 *   <Kbd>{useHotkeyLabel("mod+k")}</Kbd>
 *
 * Shortcuts without a modifier are ignored while typing in a field, so "?" or "/"
 * never steal a keystroke; combos with Ctrl/⌘/Alt fire anywhere unless
 * `ignoreInFields` says otherwise.
 */
export type HotkeyHandler = (event: KeyboardEvent) => void;

type Combo = { key: string; mod: boolean; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean };

const parse = (combo: string): Combo => {
	const parts = combo.toLowerCase().split("+");
	const key = parts.pop() ?? "";
	return {
		key,
		mod: parts.includes("mod"),
		ctrl: parts.includes("ctrl"),
		alt: parts.includes("alt"),
		shift: parts.includes("shift"),
		meta: parts.includes("meta"),
	};
};

export const matchesHotkey = (event: KeyboardEvent, combo: string): boolean => {
	const want = parse(combo);
	const modPressed = event.metaKey || event.ctrlKey;
	if (want.mod ? !modPressed : (event.ctrlKey && !want.ctrl) || (event.metaKey && !want.meta)) return false;
	if (want.ctrl && !event.ctrlKey) return false;
	if (want.meta && !event.metaKey) return false;
	if (want.alt !== event.altKey) return false;
	// Shift is part of symbols ("?" is shift+/): only checked when the combo names it or the key is a letter.
	if ((want.shift || /^[a-z]$/.test(want.key)) && want.shift !== event.shiftKey) return false;
	return event.key.toLowerCase() === want.key;
};

const isEditable = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function useHotkeys(
	bindings: Readonly<Record<string, HotkeyHandler>>,
	{ enabled = true, ignoreInFields }: { enabled?: boolean; ignoreInFields?: boolean } = {},
) {
	// The latest handlers without re-subscribing on every render.
	const latest = useRef(bindings);
	latest.current = bindings;
	useEffect(() => {
		if (!enabled) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.isComposing) return;
			for (const [combo, handler] of Object.entries(latest.current)) {
				if (!matchesHotkey(event, combo)) continue;
				const parsed = parse(combo);
				const modified = parsed.mod || parsed.ctrl || parsed.meta || parsed.alt;
				if ((ignoreInFields ?? !modified) && isEditable(event.target)) continue;
				event.preventDefault();
				handler(event);
				return;
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [enabled, ignoreInFields]);
}

const noSubscribe = () => () => {};
const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const KEY_NAMES: Record<string, string> = { escape: "Esc", enter: "↵", arrowup: "↑", arrowdown: "↓", " ": "Space" };

/**
 * A combo as the user's keyboard shows it: "⌘ K" on Apple devices, "Ctrl K" elsewhere.
 * The server (and hydration) render the "Ctrl" form; put it in a fixed-width `Kbd` so
 * the swap after hydration never shifts layout.
 */
export function useHotkeyLabel(combo: string): string {
	const apple = useSyncExternalStore(noSubscribe, isApple, () => false);
	const parsed = parse(combo);
	return [
		parsed.mod ? (apple ? "⌘" : "Ctrl") : null,
		parsed.ctrl ? "Ctrl" : null,
		parsed.meta ? "⌘" : null,
		parsed.alt ? (apple ? "⌥" : "Alt") : null,
		parsed.shift ? "⇧" : null,
		KEY_NAMES[parsed.key] ?? parsed.key.toUpperCase(),
	]
		.filter(Boolean)
		.join(" ");
}
