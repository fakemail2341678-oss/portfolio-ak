// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShortcutsProvider } from "@/components/layout/shortcuts-provider";
import { type Shortcut, useRegisteredShortcuts, useShortcutLabel, useShortcuts } from "@/hooks/use-shortcuts";

/**
 * What the hand-written `useHotkeys` did (its `matchesHotkey` tests, and its rules about
 * fields and handled key presses), now asked of TanStack Hotkeys under the app's defaults
 * (decision 0299).
 */
function Bound({ shortcuts, enabled }: { shortcuts: Shortcut[]; enabled?: boolean }) {
	useShortcuts("General", shortcuts, { enabled });
	return null;
}

function Rows() {
	const rows = useRegisteredShortcuts();
	return (
		<ul>
			{rows.map((row) => (
				<li key={row.name}>{`${row.group}: ${row.name} = ${row.keys.join(" , ")}`}</li>
			))}
		</ul>
	);
}

const press = (init: KeyboardEventInit & { key: string }, target: Element = document.body) =>
	fireEvent.keyDown(target, { bubbles: true, cancelable: true, ...init });

const mount = (shortcuts: Shortcut[], extra?: React.ReactNode) =>
	render(
		<ShortcutsProvider>
			<Bound shortcuts={shortcuts} />
			<input aria-label="field" />
			{extra}
		</ShortcutsProvider>,
	);

describe("useShortcuts", () => {
	it("Mod+K fires with Ctrl, and with nothing else held", () => {
		const run = vi.fn();
		mount([{ keys: "Mod+K", name: "Palette", run }]);
		press({ key: "k", code: "KeyK" });
		press({ key: "k", code: "KeyK", ctrlKey: true, altKey: true });
		press({ key: "K", code: "KeyK", ctrlKey: true, shiftKey: true });
		expect(run).not.toHaveBeenCalled();
		const taken = press({ key: "k", code: "KeyK", ctrlKey: true });
		expect(run).toHaveBeenCalledTimes(1);
		// fireEvent returns false when the default action was prevented.
		expect(taken).toBe(false);
	});

	it("a plain key does not fire with Ctrl held, and Escape matches whatever its case", () => {
		const save = vi.fn();
		const close = vi.fn();
		mount([
			{ keys: "S", name: "Save", run: save },
			{ keys: "Escape", name: "Close", run: close },
		]);
		press({ key: "s", code: "KeyS", ctrlKey: true });
		expect(save).not.toHaveBeenCalled();
		press({ key: "s", code: "KeyS" });
		expect(save).toHaveBeenCalledTimes(1);
		press({ key: "Escape", code: "Escape" });
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("Shift+? is the question mark, which needs Shift to type", () => {
		const run = vi.fn();
		mount([{ keys: "Shift+?", name: "Help", run }]);
		press({ key: "?", code: "Slash", shiftKey: true });
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("a single key is left to a field, a Ctrl shortcut and Escape fire there too", () => {
		const slash = vi.fn();
		const palette = vi.fn();
		const close = vi.fn();
		mount([
			{ keys: "/", name: "Search", run: slash },
			{ keys: "Mod+K", name: "Palette", run: palette },
			{ keys: "Escape", name: "Close", run: close },
		]);
		const field = screen.getByLabelText("field");
		field.focus();
		press({ key: "/", code: "Slash" }, field);
		expect(slash).not.toHaveBeenCalled();
		press({ key: "k", code: "KeyK", ctrlKey: true }, field);
		press({ key: "Escape", code: "Escape" }, field);
		expect(palette).toHaveBeenCalledTimes(1);
		expect(close).toHaveBeenCalledTimes(1);
		field.blur();
		press({ key: "/", code: "Slash" });
		expect(slash).toHaveBeenCalledTimes(1);
	});

	it("a key press a handler inside the page already took is left alone", () => {
		const run = vi.fn();
		mount(
			[{ keys: "Escape", name: "Close", run }],
			// keys: the test's stand-in for a widget that handles Escape itself.
			<button type="button" onKeyDown={(event) => event.preventDefault()}>
				widget
			</button>,
		);
		press({ key: "Escape", code: "Escape" }, screen.getByText("widget"));
		expect(run).not.toHaveBeenCalled();
	});

	it("a disabled shortcut does not fire and leaves the list; one name with two keys is one row", () => {
		const run = vi.fn();
		function Page() {
			const [on, setOn] = useState(false);
			return (
				<ShortcutsProvider>
					<Bound
						shortcuts={[
							{ keys: "ArrowLeft", name: "Previous or next move", run },
							{ keys: "ArrowRight", name: "Previous or next move", run },
							{ keys: "Z", name: "Zen", run, enabled: on },
						]}
					/>
					<Rows />
					<button type="button" onClick={() => setOn(true)}>
						on
					</button>
				</ShortcutsProvider>
			);
		}
		render(<Page />);
		expect(screen.getByText("General: Previous or next move = ← , →")).toBeTruthy();
		expect(screen.queryByText(/Zen/)).toBeNull();
		press({ key: "z", code: "KeyZ" });
		expect(run).not.toHaveBeenCalled();
		act(() => screen.getByText("on").click());
		expect(screen.getByText("General: Zen = Z")).toBeTruthy();
		press({ key: "z", code: "KeyZ" });
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("two components binding one key is a mistake the console reports (the browser review fails on it)", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const first = vi.fn();
		const second = vi.fn();
		function Page() {
			const [both, setBoth] = useState(true);
			return (
				<ShortcutsProvider>
					<Bound shortcuts={[{ keys: "Mod+K", name: "Palette", run: first }]} />
					{both ? <Bound shortcuts={[{ keys: "Mod+K", name: "Palette", run: second }]} /> : null}
					<button type="button" onClick={() => setBoth(false)}>
						leave
					</button>
				</ShortcutsProvider>
			);
		}
		render(<Page />);
		expect(warn).toHaveBeenCalled();
		act(() => screen.getByText("leave").click());
		press({ key: "k", code: "KeyK", ctrlKey: true });
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it("labels: Ctrl K on the server and elsewhere, the keys' symbols for the rest", () => {
		function Label({ keys }: { keys: Shortcut["keys"] }) {
			return <kbd>{useShortcutLabel(keys)}</kbd>;
		}
		render(
			<ShortcutsProvider>
				<Label keys="Mod+K" />
				<Label keys="Escape" />
				<Label keys="Shift+?" />
			</ShortcutsProvider>,
		);
		expect(screen.getByText("Ctrl K")).toBeTruthy();
		expect(screen.getByText("Esc")).toBeTruthy();
		expect(screen.getByText("Shift ?")).toBeTruthy();
	});
});
