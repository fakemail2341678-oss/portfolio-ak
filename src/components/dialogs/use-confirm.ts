import { createContext, useContext } from "react";
import type { ConfirmOptions } from "./confirm";

/** Asks, and resolves to the answer. */
export type Confirm = (options: ConfirmOptions) => Promise<boolean>;

/** What <ConfirmProvider> gives everything below it; null outside one. */
export const ConfirmContext = createContext<Confirm | null>(null);

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
