import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArchiveRestoreIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { lazy, type ReactNode, Suspense, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { CategoryIcon } from "../kit/category-icon";
import { FixBadge } from "../kit/fix-badge";
import { Money } from "../kit/money";
import { kharchaLinks } from "../links";
import { kharchaMutations } from "../queries";
import { useKharchaActions } from "../shell/actions";
import { type ExpenseDetail, TRASH_DAYS } from "../types";
import { historySentence } from "./history";

const ReceiptViewer = lazy(() => import("./receipt-viewer"));

const day = (value: string) => formatDate(isoDateInstant(value), { dateStyle: "medium", timeZone: "UTC" });

/**
 * An expense, read (PLAN Task 89, "the expense page"): what it was and the caller's part of
 * it, what it still needs (fix badges, a possible duplicate to dismiss), its receipts, its
 * history, and its one primary action, Edit; deleting goes to the trash, restorable for
 * 30 days. The page and the panel over Spend both show it.
 */
export function ExpensePanel({ expense, userId }: { expense: ExpenseDetail; userId: string }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { editExpense } = useKharchaActions();
	const trash = useMutation(kharchaMutations.trashExpense(queryClient, userId));
	const duplicate = useMutation(kharchaMutations.markDuplicate(queryClient, userId));
	const [viewing, setViewing] = useState<number | null>(null);
	const title = expense.title || expense.merchant || m.kharcha_untitled();
	const shared = expense.people.length > 1;

	const remove = async () => {
		const ok = await confirm({
			title: m.kharcha_expense_delete_title(),
			description: m.kharcha_expense_delete_body({ days: formatNumber(TRASH_DAYS) }),
			confirmLabel: m.kharcha_expense_delete(),
			destructive: true,
		});
		if (!ok) return;
		try {
			await trash.mutateAsync({ expenseId: expense.id, restore: false });
			toast.success(m.kharcha_expense_deleted());
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const restore = async () => {
		try {
			await trash.mutateAsync({ expenseId: expense.id, restore: true });
			toast.success(m.kharcha_expense_restored());
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const notDuplicate = async () => {
		try {
			await duplicate.mutateAsync({ expenseId: expense.id, ok: true });
			toast.success(m.kharcha_duplicate_dismissed());
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	return (
		<article className="flex flex-col gap-5" data-testid="kharcha-expense">
			<header className="flex items-start gap-3">
				<CategoryIcon
					icon={expense.category?.icon ?? null}
					{...(expense.category ? { color: expense.category.color } : {})}
					size="md"
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<p className="flex flex-wrap items-center gap-2 text-caption text-kh-muted">
						<time dateTime={expense.spentOn}>{day(expense.spentOn)}</time>
						{expense.kind === "refund" ? (
							<span className="rounded-sm border border-kh-hair px-1.5 text-[0.75rem]">{m.kharcha_kit_refund()}</span>
						) : null}
					</p>
					<Money amountMinor={expense.amountMinor} currency={expense.currency} size="lg" />
					{shared ? (
						<p className="text-caption text-kh-muted">
							{m.kharcha_expense_your_share()}{" "}
							<Money amountMinor={expense.myShareMinor} currency={expense.currency} size="sm" />
						</p>
					) : null}
				</div>
			</header>

			{expense.deletedAt ? (
				<div className="kh-hatch flex flex-wrap items-center gap-3 rounded-md border border-kh-owe px-3 py-2 text-sm">
					<p className="flex-1">{m.kharcha_expense_in_trash({ days: formatNumber(TRASH_DAYS) })}</p>
					{expense.can.restore ? (
						<Button size="sm" onClick={() => void restore()} disabled={trash.isPending}>
							<ArchiveRestoreIcon aria-hidden />
							{m.kharcha_expense_restore()}
						</Button>
					) : null}
				</div>
			) : null}

			{expense.fixes.length > 0 ? (
				<section aria-label={m.kharcha_expense_fixes()} className="flex flex-col gap-2">
					<p className="flex flex-wrap gap-1.5">
						{expense.fixes.map((kind) => (
							<FixBadge key={kind} kind={kind} />
						))}
					</p>
					{expense.duplicates.length > 0 ? (
						<div className="flex flex-col gap-2 rounded-md border border-kh-hair bg-kh-ground px-3 py-2 text-sm">
							<p>
								{m.kharcha_duplicate_of()}{" "}
								{expense.duplicates.map((ref, index) => (
									<span key={ref.id}>
										{index > 0 ? ", " : null}
										<Link
											{...kharchaLinks.expense(ref.id)}
											className="font-medium text-kh-mark underline underline-offset-4"
										>
											{ref.title || m.kharcha_untitled()}
										</Link>{" "}
										<span className="text-kh-muted">({day(ref.spentOn)})</span>
									</span>
								))}
							</p>
							<div>
								<Button size="sm" variant="outline" onClick={() => void notDuplicate()} disabled={duplicate.isPending}>
									{m.kharcha_duplicate_dismiss()}
								</Button>
							</div>
						</div>
					) : null}
				</section>
			) : null}

			<dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
				<Row label={m.kharcha_field_title()}>{title}</Row>
				{expense.merchant ? <Row label={m.kharcha_field_merchant()}>{expense.merchant}</Row> : null}
				<Row label={m.kharcha_field_category()}>
					{expense.category ? (
						expense.category.name
					) : (
						<span className="text-kh-muted">{m.kharcha_category_none()}</span>
					)}
				</Row>
				{expense.tags.length > 0 ? (
					<Row label={m.kharcha_field_tags()}>
						<span className="flex flex-wrap gap-1">
							{expense.tags.map((tag) => (
								<span key={tag.id} className="rounded-sm bg-kh-ground px-1.5 text-[0.8125rem]">
									{tag.name}
								</span>
							))}
						</span>
					</Row>
				) : null}
				{expense.method ? <Row label={m.kharcha_field_method()}>{expense.method.name}</Row> : null}
				{shared ? (
					<Row label={m.kharcha_expense_people()}>
						{expense.people.map((person) => (person.isMe ? m.kharcha_you_subject() : person.name)).join(", ")}
					</Row>
				) : null}
				{expense.notes ? (
					<Row label={m.kharcha_field_notes()}>
						<span className="whitespace-pre-line">{expense.notes}</span>
					</Row>
				) : null}
			</dl>

			<section aria-labelledby={`${expense.id}-receipts`} className="flex flex-col gap-2">
				<h2 id={`${expense.id}-receipts`} className="font-semibold text-sm">
					{m.kharcha_receipts_label()}
				</h2>
				{expense.receipts.length === 0 ? (
					<p className="text-caption text-kh-muted">{m.kharcha_receipts_none()}</p>
				) : (
					<ul className="flex flex-wrap gap-2">
						{expense.receipts.map((receipt, index) => (
							<li key={receipt.id}>
								<button
									type="button"
									onClick={() => setViewing(index)}
									className="kh-ease relative block size-24 overflow-hidden rounded-md border border-kh-hair bg-kh-ground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<CloudImage
										image={receipt}
										variant="thumb"
										alt=""
										className="size-full object-cover"
										loading="lazy"
									/>
									{receipt.format === "pdf" ? (
										<span className="absolute start-1 bottom-1 rounded-sm bg-kh-page px-1 font-semibold text-[0.6875rem]">
											PDF
										</span>
									) : null}
									<span className="sr-only">{m.kharcha_receipt_open({ number: formatNumber(index + 1) })}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</section>

			<div className="flex flex-wrap gap-2">
				{expense.can.edit ? (
					<Button onClick={() => editExpense(expense)} data-testid="kharcha-expense-edit">
						<PencilIcon aria-hidden />
						{m.kharcha_expense_edit()}
					</Button>
				) : null}
				{expense.can.delete ? (
					<Button variant="ghost" onClick={() => void remove()} disabled={trash.isPending}>
						<Trash2Icon aria-hidden />
						{m.kharcha_expense_delete()}
					</Button>
				) : null}
			</div>

			<section aria-labelledby={`${expense.id}-history`} className="flex flex-col gap-2">
				<h2 id={`${expense.id}-history`} className="font-semibold text-sm">
					{m.kharcha_expense_history()}
				</h2>
				<ol className="flex flex-col gap-1.5 border-kh-hair border-s ps-3">
					{expense.activity.map((line) => (
						<li key={line.id} className="text-caption">
							<span className="text-kh-ink">{historySentence(line, expense.currency)}</span>{" "}
							<time dateTime={line.at} className="text-kh-muted">
								{formatDateTime(line.at)}
							</time>
						</li>
					))}
				</ol>
			</section>

			{viewing !== null ? (
				<Suspense fallback={null}>
					<ReceiptViewer receipts={expense.receipts} start={viewing} onClose={() => setViewing(null)} />
				</Suspense>
			) : null}
		</article>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<>
			<dt className="text-kh-muted">{label}</dt>
			<dd className="min-w-0 wrap-anywhere">{children}</dd>
		</>
	);
}
