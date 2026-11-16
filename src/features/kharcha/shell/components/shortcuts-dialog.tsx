import { ShortcutsList } from "@/components/dialogs/shortcuts-list";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";

/**
 * Every keyboard shortcut in Kharcha (PLAN 14.6 "Keyboard first"). `?` opens it. The
 * shortcuts the page has bound are listed from the registry (`useShortcuts` names them,
 * decision 0299); the rows below are the keys lists and dialogs handle themselves.
 */
export function KharchaShortcutsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="shortcuts-dialog">
				<DialogHeader>
					<DialogTitle className="kh-display">{m.kharcha_shortcuts_title()}</DialogTitle>
					<DialogDescription>{m.kharcha_shortcuts_description()}</DialogDescription>
				</DialogHeader>
				<ShortcutsList
					extraTitle={m.shortcuts_group_widgets()}
					extra={[
						{ keys: ["↑", "↓", "↵"], name: m.kharcha_shortcut_pick() },
						{ keys: ["Esc"], name: m.kharcha_shortcut_close() },
					]}
				/>
			</DialogContent>
		</Dialog>
	);
}
