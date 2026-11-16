import {
	type RegisterableHotkey,
	useFormatForDisplay,
	useHotkeyRegistrations,
	useHotkeys,
} from "@tanstack/react-hotkeys";

/**
 * One keyboard shortcut. `keys` is TanStack Hotkeys' notation: "Mod+K" (⌘ on Apple devices,
 * Ctrl elsewhere), "Shift+?", "N", "Escape", "ArrowLeft", or a sequence `["G", "H"]`.
 * `name` is what the shortcuts dialog calls it: a message, read at render time.
 */
export type Shortcut = {
	keys: RegisterableHotkey;
	name: string;
	run: (event: KeyboardEvent) => void;
	/** `false` keeps the shortcut registered but silent (it leaves the shortcuts dialog too). */
	enabled?: boolean;
};

/** A shortcut as the shortcuts dialog shows it: its name and every key bound to it, as labels. */
export type ShortcutRow = { group: string; name: string; keys: string[] };

/**
 * Registers a component's keyboard shortcuts with TanStack Hotkeys (decision 0299), each with a
 * name and a group so the shortcuts dialog lists what is really bound (`ShortcutsList`):
 *
 *   useShortcuts(m.shortcuts_group_general(), [
 *     { keys: "Mod+K", name: m.command_title(), run: () => setOpen(true) },
 *   ]);
 *   <Kbd>{useShortcutLabel("Mod+K")}</Kbd>
 *
 * A single key or a Shift/Alt combination is skipped while a field or a widget uses the key
 * itself, so "?" or "/" never steal a keystroke; Ctrl/⌘ shortcuts and Escape fire anywhere.
 * The defaults (a key press another handler already took is left alone) are
 * `ShortcutsProvider`'s. A widget's own keyboard model (arrow keys in a grid, Enter in a
 * field) is not a shortcut: it stays an `onKeyDown` with a `// keys: <reason>` comment.
 */
export function useShortcuts(
	group: string,
	shortcuts: ReadonlyArray<Shortcut>,
	{ enabled = true }: { enabled?: boolean } = {},
) {
	useHotkeys(
		shortcuts.map((shortcut) => ({
			hotkey: shortcut.keys,
			callback: (event: KeyboardEvent) => shortcut.run(event),
			options: { enabled: enabled && (shortcut.enabled ?? true), meta: { name: shortcut.name, group } },
		})),
	);
}

/**
 * Formats shortcuts as the user's keyboard shows them: "⌘ K" on Apple devices, "Ctrl K"
 * elsewhere. The server (and hydration) render the "Ctrl" form: put the label in a fixed-width
 * `Kbd` so the swap after hydration never shifts layout.
 */
export function useShortcutFormat(): (keys: RegisterableHotkey) => string {
	const format = useFormatForDisplay();
	return (keys) => format(keys, { separatorToken: " " });
}

/** One shortcut's label, for a `Kbd` beside the control it triggers. */
export function useShortcutLabel(keys: RegisterableHotkey): string {
	return useShortcutFormat()(keys);
}

/**
 * Every shortcut that is registered and enabled right now, in the order it was registered:
 * what the shortcuts dialog lists. Two keys with one name (←/→, or "Mod+K" and "/") make one row.
 */
export function useRegisteredShortcuts(): ShortcutRow[] {
	const registrations = useHotkeyRegistrations();
	const format = useShortcutFormat();
	const rows = new Map<string, ShortcutRow>();
	for (const registration of registrations) {
		const { name, group = "" } = registration.options.meta ?? {};
		if (!name || registration.status === "disabled") continue;
		const id = `${group}\n${name}`;
		const row = rows.get(id) ?? { group, name, keys: [] };
		const label = format(registration.hotkey);
		if (!row.keys.includes(label)) row.keys.push(label);
		rows.set(id, row);
	}
	return [...rows.values()];
}
