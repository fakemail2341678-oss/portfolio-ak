import { useQuery } from "@tanstack/react-query";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { m } from "@/paraglide/messages";
import { kharchaExpenseQueryOptions } from "../queries";
import { ExpensePanel } from "./expense-panel";

/**
 * The expense over a list (PLAN 14.5 "UX": the expense in a right-hand panel): `?expense=`
 * on Spend, a masked route, so the address bar, a reload, a new tab and no JavaScript give
 * its page, /e/$expenseId. Loaded when it opens, with placeholder lines meanwhile; on a
 * phone it takes the whole screen. Closing goes back to the list.
 */
export default function ExpenseSheet({
	userId,
	expenseId,
	onClose,
}: {
	userId: string;
	expenseId: string;
	onClose: () => void;
}) {
	const { data: expense, error } = useQuery(kharchaExpenseQueryOptions(userId, expenseId));
	return (
		<Sheet open onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="w-full overflow-y-auto bg-kh-page sm:max-w-lg" data-testid="kharcha-expense-sheet">
				<SheetHeader className="pe-10">
					<SheetTitle className="kh-display text-kh-head wrap-anywhere">
						{expense ? expense.title || expense.merchant || m.kharcha_untitled() : m.kharcha_expense_loading()}
					</SheetTitle>
					<SheetDescription>{m.kharcha_expense_sheet_description()}</SheetDescription>
				</SheetHeader>
				<div className="px-4 pb-6">
					{expense ? (
						<ExpensePanel expense={expense} userId={userId} />
					) : error ? (
						<div className="flex flex-col items-start gap-3">
							<p className="text-destructive text-sm" role="alert">
								{errorMessage(error)}
							</p>
							<Button variant="outline" onClick={onClose}>
								{m.dialog_close()}
							</Button>
						</div>
					) : (
						<output className="flex flex-col gap-4" aria-busy="true">
							<span className="sr-only">{m.kharcha_expense_loading()}</span>
							{Array.from({ length: 5 }, (_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows have no identity.
								<span key={index} className="block h-9 w-full animate-pulse rounded-md bg-kh-ground" />
							))}
						</output>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
