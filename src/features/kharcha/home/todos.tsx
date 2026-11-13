import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HandCoinsIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ExpenseCard } from "../kit/cards";
import { FixBadge } from "../kit/fix-badge";
import { BalancePill } from "../kit/money";
import { PersonAvatar } from "../kit/person-avatar";
import { kharchaLinks } from "../links";
import { kharchaMutations } from "../queries";
import { useKharchaActions, useKharchaUserId } from "../shell/actions";
import type { HomeTodo, ReceiptDraftView } from "../types";

/**
 * Home's to-dos (PLAN 14.5 "Home is a to-do list", Tasks 89 and 91): receipts waiting for
 * their details, debts to settle, then possible duplicates. Each has its one next step: "Add
 * details" opens the expense dialog with the receipt; "Settle up" the settle-up dialog with
 * that friend; a duplicate opens its expense, where it can be dismissed.
 */
export function TodoList({ todos }: { todos: ReadonlyArray<HomeTodo> }) {
	return (
		<ul className="divide-y divide-kh-rule" data-testid="kharcha-todos">
			{todos.map((todo) =>
				todo.kind === "receipt" ? (
					<DraftTodo key={todo.draft.id} draft={todo.draft} />
				) : todo.kind === "settle" ? (
					<SettleTodo key={todo.person.id} todo={todo} />
				) : (
					<li
						key={todo.expense.id}
						className="flex flex-col gap-2 px-4 py-3 sm:px-5"
						data-testid="kharcha-todo-duplicate"
					>
						<ExpenseCard
							expense={todo.expense}
							category={todo.expense.category?.icon ?? null}
							{...(todo.expense.category ? { categoryColor: todo.expense.category.color } : {})}
							fixes={["duplicate"]}
							link={({ className, children }) => (
								<Link {...kharchaLinks.expense(todo.expense.id)} className={className}>
									{children}
								</Link>
							)}
						/>
						<p className="text-caption text-kh-muted">
							{m.kharcha_todo_duplicate_of({
								title: todo.of.title || m.kharcha_untitled(),
								date: formatDate(isoDateInstant(todo.of.spentOn), { dateStyle: "medium", timeZone: "UTC" }),
							})}
						</p>
					</li>
				),
			)}
		</ul>
	);
}

function SettleTodo({ todo }: { todo: Extract<HomeTodo, { kind: "settle" }> }) {
	const { settleUp } = useKharchaActions();
	return (
		<li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5" data-testid="kharcha-todo-settle">
			<PersonAvatar name={todo.person.name} color={todo.person.color} />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<Link {...kharchaLinks.friend(todo.person.id)} className="truncate font-semibold hover:underline">
					{todo.person.name}
				</Link>
				<BalancePill
					balances={todo.owe.map((amount) => ({ ...amount, amountMinor: -amount.amountMinor }))}
					layout="inline"
				/>
			</div>
			<Button size="sm" onClick={() => settleUp({ personId: todo.person.id })} data-testid="kharcha-todo-settle-up">
				<HandCoinsIcon aria-hidden />
				{m.kharcha_create_settle()}
			</Button>
		</li>
	);
}

function DraftTodo({ draft }: { draft: ReceiptDraftView }) {
	const userId = useKharchaUserId();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { addExpense } = useKharchaActions();
	const discard = useMutation(kharchaMutations.deleteDraft(queryClient, userId));
	const [first] = draft.receipts;
	const remove = async () => {
		const ok = await confirm({
			title: m.kharcha_todo_receipt_discard_title(),
			description: m.kharcha_todo_receipt_discard_body(),
			confirmLabel: m.kharcha_todo_receipt_discard(),
			destructive: true,
		});
		if (!ok) return;
		try {
			await discard.mutateAsync(draft.id);
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	return (
		<li className="flex items-center gap-3 px-4 py-3 sm:px-5" data-testid="kharcha-todo-receipt">
			<span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-kh-hair bg-kh-ground">
				{first ? (
					<CloudImage image={first} variant="thumb" alt="" className="size-full object-cover" loading="lazy" />
				) : null}
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="flex flex-wrap items-center gap-2">
					<span className="font-semibold">
						{draft.receipts.length > 1
							? m.kharcha_todo_receipts({ count: formatNumber(draft.receipts.length) })
							: m.kharcha_todo_receipt()}
					</span>
					<FixBadge kind="receipt" />
				</p>
				<p className="text-caption text-kh-muted">
					{m.kharcha_todo_receipt_added({ when: formatDateTime(draft.createdAt) })}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<Button size="sm" onClick={() => addExpense({ draft })} data-testid="kharcha-todo-receipt-fill">
					{m.kharcha_todo_receipt_fill()}
				</Button>
				<Button size="icon" variant="ghost" onClick={() => void remove()} disabled={discard.isPending}>
					<Trash2Icon aria-hidden />
					<span className="sr-only">{m.kharcha_todo_receipt_discard()}</span>
				</Button>
			</div>
		</li>
	);
}
