import { WalletIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/i18n/currency";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { CategoryIconName, ExpenseView, FixKind, KharchaColor, KharchaPerson, PaymentView } from "../types";
import { CategoryIcon } from "./category-icon";
import { FixBadge } from "./fix-badge";
import { Money } from "./money";

const nameOf = (people: ReadonlyArray<KharchaPerson>, id: string) => people.find((person) => person.id === id);

/**
 * The title of a card: a button when the card opens something (the expense panel), with
 * its hit area stretched over the whole card, so the card is one keyboard stop.
 */
function CardTitle({ children, onOpen }: { children: ReactNode; onOpen?: () => void }) {
	const text = <span className="font-semibold">{children}</span>;
	if (!onOpen) return text;
	return (
		<button
			type="button"
			onClick={onOpen}
			className="text-start after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
		>
			{text}
		</button>
	);
}

/** What the expense did to the caller, in words beside the amount. */
function expenseEffect(expense: CardExpense): { tone: "owed" | "owe" | "muted"; amount: number; words: string } {
	const net = expense.myPaidMinor - expense.myShareMinor;
	if (expense.myPaidMinor === 0 && expense.myShareMinor === 0)
		return { tone: "muted", amount: 0, words: m.kharcha_kit_not_involved() };
	if (net > 0) return { tone: "owed", amount: net, words: m.kharcha_kit_you_lent() };
	if (net < 0) {
		const payers = expense.payers.filter((payer) => payer.amountMinor > 0);
		const payer = payers.length === 1 && payers[0] ? nameOf(expense.people, payers[0].personId) : undefined;
		return {
			tone: "owe",
			amount: -net,
			words: payer ? m.kharcha_kit_you_owe_name({ name: payer.name }) : m.kharcha_kit_you_borrowed(),
		};
	}
	return { tone: "muted", amount: 0, words: m.kharcha_kit_even() };
}

/** Who paid, in words: "You paid NPR 3,200.00", "Asha Gurung paid …", "3 people paid …". */
function paidLine(expense: CardExpense): string {
	const amount = formatMoney(expense.amountMinor, expense.currency);
	const payers = expense.payers.filter((payer) => payer.amountMinor > 0);
	const only = payers.length === 1 && payers[0] ? nameOf(expense.people, payers[0].personId) : undefined;
	if (only?.isMe) return m.kharcha_kit_you_paid({ amount });
	if (only) return m.kharcha_kit_paid_by({ name: only.name, amount });
	return m.kharcha_kit_people_paid({ count: formatNumber(payers.length), amount });
}

type CardExpense = Pick<
	ExpenseView,
	"title" | "kind" | "amountMinor" | "currency" | "payers" | "people" | "myShareMinor" | "myPaidMinor"
>;

/**
 * An expense on a page (PLAN 14.5, "Conversations"): its category, title and who paid on
 * the left; on the right, what it means for the caller, in colour and in words ("you
 * lent", "you owe Asha", "not involved"). Fix badges say what it still needs.
 */
export function ExpenseCard({
	expense,
	category,
	categoryColor,
	fixes = [],
	onOpen,
	className,
}: {
	expense: CardExpense;
	category?: CategoryIconName | null;
	categoryColor?: KharchaColor;
	fixes?: ReadonlyArray<FixKind>;
	/** Opens the expense (its panel on a laptop, its page on a phone). */
	onOpen?: () => void;
	className?: string;
}) {
	const effect = expenseEffect(expense);
	return (
		<article className={cn("relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3", className)}>
			<CategoryIcon icon={category} {...(categoryColor ? { color: categoryColor } : {})} />
			<div className="min-w-0">
				<p className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<CardTitle {...(onOpen ? { onOpen } : {})}>{expense.title}</CardTitle>
					{expense.kind === "refund" ? (
						<span className="rounded-sm border border-kh-hair px-1.5 text-[0.75rem] text-kh-muted">
							{m.kharcha_kit_refund()}
						</span>
					) : null}
					{fixes.map((kind) => (
						<FixBadge key={kind} kind={kind} />
					))}
				</p>
				<p className="truncate text-caption text-kh-muted">{paidLine(expense)}</p>
			</div>
			<p className="flex max-w-[11rem] flex-col items-end text-balance text-end sm:max-w-none" data-tone={effect.tone}>
				{effect.amount > 0 ? (
					<Money amountMinor={effect.amount} currency={expense.currency} tone={effect.tone} />
				) : null}
				<span
					className={cn(
						"font-medium text-[0.75rem]",
						effect.tone === "owed" && "text-kh-owed",
						effect.tone === "owe" && "text-kh-owe",
						effect.tone === "muted" && "text-kh-muted",
					)}
				>
					{effect.words}
				</span>
			</p>
		</article>
	);
}

type CardPayment = Pick<
	PaymentView,
	"fromId" | "toId" | "amountMinor" | "currency" | "paid" | "method" | "note" | "people"
>;

/** Who paid whom, in words, the caller as "you". */
function paymentLine(payment: CardPayment): string {
	const from = nameOf(payment.people, payment.fromId);
	const to = nameOf(payment.people, payment.toId);
	const fromName = from?.name ?? "";
	const toName = to?.name ?? "";
	if (from?.isMe) return m.kharcha_kit_payment_you_paid({ to: toName });
	if (to?.isMe) return m.kharcha_kit_payment_paid_you({ from: fromName });
	return m.kharcha_kit_payment_line({ from: fromName, to: toName });
}

/**
 * A payment on a page: settling up, recorded. Its amount is struck through in red ink,
 * the book's mark for a debt cleared (the words stay unstruck, to be read); the method and the note say how it was paid, and a
 * payment in another currency shows what was really handed over.
 */
export function PaymentCard({
	payment,
	onOpen,
	className,
}: {
	payment: CardPayment;
	onOpen?: () => void;
	className?: string;
}) {
	const details = [
		payment.method,
		payment.paid
			? m.kharcha_kit_payment_converted({
					paid: formatMoney(payment.paid.amountMinor, payment.paid.currency),
					rate: payment.paid.rate,
				})
			: "",
		payment.note,
	].filter(Boolean);
	return (
		<article className={cn("relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3", className)}>
			<span
				aria-hidden
				className="inline-grid size-8 shrink-0 place-items-center rounded-md border border-kh-hair bg-kh-ground text-kh-muted"
			>
				<WalletIcon className="size-4" strokeWidth={1.75} />
			</span>
			<div className="min-w-0">
				<p>
					<CardTitle {...(onOpen ? { onOpen } : {})}>{paymentLine(payment)}</CardTitle>
				</p>
				{details.length > 0 ? <p className="truncate text-caption text-kh-muted">{details.join(" · ")}</p> : null}
			</div>
			<p className="flex flex-col items-end text-end">
				<Money amountMinor={payment.amountMinor} currency={payment.currency} struck />
				<span className="font-medium text-[0.75rem] text-kh-muted">{m.kharcha_kit_payment()}</span>
			</p>
		</article>
	);
}
