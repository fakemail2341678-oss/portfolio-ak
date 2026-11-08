import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useHotkeyLabel } from "@/hooks/use-hotkeys";
import { m } from "@/paraglide/messages";

/**
 * Every keyboard shortcut in Chaal (PLAN 13.6, "Keyboard"), opened with `?` or from the
 * palette. Shortcuts go through `useHotkeys` and are listed here: the board's (←/→, Home,
 * End, `f`, `/`) came with the board kit (Task 74); zen (`z`) joins with play.
 */
export function ChaalShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const palette = useHotkeyLabel("mod+k");
	const rows = [
		{ keys: [palette], label: m.ch_shortcut_palette() },
		{ keys: ["?"], label: m.ch_shortcut_help() },
		{ keys: ["↑", "↓", "↵"], label: m.ch_shortcut_palette_pick() },
		{ keys: ["Esc"], label: m.ch_shortcut_close() },
		// The board's (Task 74): `useBoardKeys` and the move input.
		{ keys: ["←", "→"], label: m.ch_shortcut_moves() },
		{ keys: ["Home", "End"], label: m.ch_shortcut_ends() },
		{ keys: ["f"], label: m.ch_control_flip() },
		{ keys: ["/"], label: m.ch_move_input_label() },
	];
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="chaal-shortcuts">
				<DialogHeader>
					<DialogTitle className="ch-display text-ch-head">{m.ch_shortcuts_title()}</DialogTitle>
					<DialogDescription>{m.ch_shortcuts_description()}</DialogDescription>
				</DialogHeader>
				<dl className="flex flex-col text-body">
					{rows.map((row) => (
						<div key={row.label} className="ch-hairline flex items-center justify-between gap-4 py-2 last:border-b-0">
							<dt>{row.label}</dt>
							<dd className="flex shrink-0 gap-1" dir="ltr">
								{row.keys.map((key) => (
									<Kbd key={key}>{key}</Kbd>
								))}
							</dd>
						</div>
					))}
				</dl>
			</DialogContent>
		</Dialog>
	);
}
