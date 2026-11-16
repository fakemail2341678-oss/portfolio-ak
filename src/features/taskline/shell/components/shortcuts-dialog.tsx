import { ShortcutsList } from "@/components/dialogs/shortcuts-list";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShortcutLabel } from "@/hooks/use-shortcuts";
import { m } from "@/paraglide/messages";

/**
 * Every keyboard shortcut in Taskline. `?` opens it. The shortcuts the page has bound are
 * listed from the registry (`useShortcuts` names them, decision 0299); the rows below are
 * the keys widgets handle themselves: the sidebar's own toggle, the palette's list, the
 * board's moves (a task's handle), the calendar's (Task 51: a day, a week), the timesheet.
 */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const sidebar = useShortcutLabel("Mod+B");
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="shortcuts-dialog">
				<DialogHeader>
					<DialogTitle>{m.taskline_shortcuts_title()}</DialogTitle>
					<DialogDescription>{m.taskline_shortcuts_description()}</DialogDescription>
				</DialogHeader>
				<ShortcutsList
					extraTitle={m.shortcuts_group_widgets()}
					extra={[
						{ keys: [sidebar], name: m.taskline_shortcut_sidebar() },
						{ keys: ["↑", "↓", "↵"], name: m.taskline_shortcut_palette_pick() },
						{ keys: ["Esc"], name: m.taskline_shortcut_close() },
						{ keys: ["Alt", "↑↓←→"], name: m.taskline_shortcut_board_move() },
						{ keys: ["Alt", "←→"], name: m.taskline_shortcut_calendar_day() },
						{ keys: ["Alt", "↑↓"], name: m.taskline_shortcut_calendar_week() },
						{ keys: ["↑↓←→", "↵"], name: m.taskline_shortcut_timesheet() },
					]}
				/>
			</DialogContent>
		</Dialog>
	);
}
