import { ShortcutsList } from "@/components/dialogs/shortcuts-list";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";

/**
 * Every keyboard shortcut in Chaal (PLAN 13.6, "Keyboard"), opened with `?` or from the
 * palette. The shortcuts the page has bound are listed from the registry (`useShortcuts`
 * names them, decision 0299): the frame's everywhere, the board's (←/→, Home, End, `f`,
 * `/`) on a page with a board, zen (`z`) on a game's page. The rows below are the keys the
 * palette and the dialogs handle themselves.
 */
export function ChaalShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="chaal-shortcuts">
				<DialogHeader>
					<DialogTitle className="ch-display text-ch-head">{m.chaal_shortcuts_title()}</DialogTitle>
					<DialogDescription>{m.chaal_shortcuts_description()}</DialogDescription>
				</DialogHeader>
				<ShortcutsList
					rowClassName="ch-hairline last:border-b-0"
					extraTitle={m.shortcuts_group_widgets()}
					extra={[
						{ keys: ["↑", "↓", "↵"], name: m.chaal_shortcut_palette_pick() },
						{ keys: ["Esc"], name: m.chaal_shortcut_close() },
					]}
				/>
			</DialogContent>
		</Dialog>
	);
}
