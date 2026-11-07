import { useBlocker } from "@tanstack/react-router";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { m } from "@/paraglide/messages";

/**
 * Asks before leaving a page with unsaved changes: in-app navigation shows a
 * localized dialog; reloading or closing the tab triggers the browser's own
 * prompt (beforeunload; browsers don't allow custom text there).
 *
 * `when` is read at navigation time, so pass a function (e.g. reading form state).
 */
export function UnsavedChangesGuard({ when }: { when: () => boolean }) {
	const { status, proceed, reset } = useBlocker({
		shouldBlockFn: () => when(),
		enableBeforeUnload: () => when(),
		withResolver: true,
	});
	return (
		<AlertDialog open={status === "blocked"} onOpenChange={(open) => !open && reset?.()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{m.unsaved_title()}</AlertDialogTitle>
					<AlertDialogDescription>{m.unsaved_body()}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={() => reset?.()}>{m.unsaved_stay()}</AlertDialogCancel>
					<AlertDialogAction variant="destructive" onClick={() => proceed?.()}>
						{m.unsaved_leave()}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
