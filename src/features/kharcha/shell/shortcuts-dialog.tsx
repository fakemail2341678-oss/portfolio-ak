import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useHotkeyLabel } from "@/hooks/use-hotkeys";
import { m } from "@/paraglide/messages";

/**
 * Every keyboard shortcut in Kharcha (PLAN 14.6 "Keyboard first": shortcuts go through
 * `useHotkeys` and are listed here). `?` opens it. Each task adds its rows (the split
 * editor's in 90).
 */
export function KharchaShortcutsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const palette = useHotkeyLabel("mod+k");
	const rows = [
		{ keys: [palette], label: m.kharcha_shortcut_palette() },
		{ keys: ["?"], label: m.kharcha_shortcut_help() },
		{ keys: ["↑", "↓", "↵"], label: m.kharcha_shortcut_pick() },
		{ keys: ["Esc"], label: m.kharcha_shortcut_close() },
	];
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="shortcuts-dialog">
				<DialogHeader>
					<DialogTitle className="kh-display">{m.kharcha_shortcuts_title()}</DialogTitle>
					<DialogDescription>{m.kharcha_shortcuts_description()}</DialogDescription>
				</DialogHeader>
				<dl className="flex flex-col divide-y text-body">
					{rows.map((row) => (
						<div key={row.label} className="flex items-center justify-between gap-4 py-2">
							<dt>{row.label}</dt>
							<dd className="flex shrink-0 gap-1">
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
