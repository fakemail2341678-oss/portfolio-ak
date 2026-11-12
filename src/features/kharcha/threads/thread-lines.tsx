import { m } from "@/paraglide/messages";
import { recentSentence } from "../home/recent-line";
import { type CardLink, ExpenseCard, PaymentCard } from "../kit/cards";
import { LedgerLine, LedgerPage, SystemLine } from "../kit/ledger";
import type { ThreadItem } from "../types";

/**
 * A thread's page of the book (Task 90, PLAN 14.5 "Conversations"): its lines oldest
 * first, each day once in the margin: expense cards that open the expense, payment cards,
 * and the app's own system lines. `expenseLink` makes an expense's link (the panel over the
 * thread, masked as its page).
 */
export function ThreadLines({
	items,
	more,
	expenseLink,
	label,
}: {
	items: ReadonlyArray<ThreadItem>;
	more: boolean;
	expenseLink: (expenseId: string) => CardLink;
	label: string;
}) {
	return (
		<section
			aria-label={label}
			className="overflow-hidden rounded-lg border border-kh-hair"
			data-testid="kharcha-thread"
		>
			<LedgerPage>
				{more ? (
					<LedgerLine>
						<SystemLine>{m.kharcha_thread_more()}</SystemLine>
					</LedgerLine>
				) : null}
				{items.map((item, index) => {
					const day = items[index - 1]?.day === item.day ? {} : { day: item.day };
					return (
						<LedgerLine key={`${item.type}:${item.id}`} {...day}>
							{item.type === "expense" ? (
								<ExpenseCard
									expense={item.expense}
									category={item.expense.category?.icon ?? null}
									{...(item.expense.category ? { categoryColor: item.expense.category.color } : {})}
									fixes={item.expense.fixes}
									link={expenseLink(item.expense.id)}
								/>
							) : item.type === "payment" ? (
								<PaymentCard payment={item.payment} />
							) : (
								<SystemLine>{recentSentence(item.line)}</SystemLine>
							)}
						</LedgerLine>
					);
				})}
			</LedgerPage>
		</section>
	);
}
