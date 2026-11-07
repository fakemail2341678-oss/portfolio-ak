import { createContext, type ReactNode, useContext, useRef, useState } from "react";
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

export type ConfirmOptions = {
	title: ReactNode;
	description: ReactNode;
	/** Label of the confirming button (default "Confirm"). */
	confirmLabel?: string;
	cancelLabel?: string;
	/** Destructive actions get the red button. Focus always starts on Cancel. */
	destructive?: boolean;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * "Are you sure?" as a promise: `if (await confirm({ title, description })) remove()`.
 * The page keeps no dialog state of its own. Needs a <ConfirmProvider> above it;
 * the shells mount one (AdminShell, the account and /dev layouts).
 */
export function useConfirm(): Confirm {
	const confirm = useContext(ConfirmContext);
	if (!confirm) throw new Error("useConfirm needs a <ConfirmProvider> (the section's shell renders one).");
	return confirm;
}

type Pending = ConfirmOptions & { resolve: (confirmed: boolean) => void };

/** One confirm dialog for everything below it. Asking again while one is open answers the first with "no". */
export function ConfirmProvider({ children }: { children: ReactNode }) {
	const [pending, setPending] = useState<Pending | null>(null);
	// Kept while the dialog animates out, so its text doesn't blank during the close.
	const [shown, setShown] = useState<ConfirmOptions | null>(null);
	const current = useRef<Pending | null>(null);

	const settle = (confirmed: boolean) => {
		current.current?.resolve(confirmed);
		current.current = null;
		setPending(null);
	};
	const confirm: Confirm = (options) =>
		new Promise<boolean>((resolve) => {
			current.current?.resolve(false);
			const next = { ...options, resolve };
			current.current = next;
			setPending(next);
			setShown(options);
		});

	return (
		<ConfirmContext value={confirm}>
			{children}
			<AlertDialog open={pending !== null} onOpenChange={(open) => !open && settle(false)}>
				<AlertDialogContent data-testid="confirm-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{shown?.title}</AlertDialogTitle>
						<AlertDialogDescription>{shown?.description}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{shown?.cancelLabel ?? m.common_cancel()}</AlertDialogCancel>
						<AlertDialogAction
							variant={shown?.destructive ? "destructive" : "default"}
							data-testid="confirm-action"
							onClick={() => settle(true)}
						>
							{shown?.confirmLabel ?? m.common_confirm()}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ConfirmContext>
	);
}
