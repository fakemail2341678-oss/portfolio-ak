import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DownloadIcon, FolderIcon, TagIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCsv, toCsv } from "@/lib/csv";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { Money } from "../kit/money";
import { exportKharcha, kharchaMutations } from "../queries";
import type { BulkInput } from "../schema";
import { type KharchaLists, type SpendItem, type SpendPage, TRASH_DAYS } from "../types";
import { EXPORT_COLUMNS } from "./csv";

/**
 * Spend's table view (Task 93): the page's rows in a DataTable, its Columns menu choosing
 * what shows (kept per browser), sorting by the header links, and the selection's bulk
 * actions: a category, a tag or the method for the caller's own part, the trash, and a CSV
 * of the rows chosen. Payments are listed but take no bulk action (they are skipped).
 */

const dayOf = (item: SpendItem) => (item.source === "expense" ? item.spentOn : item.paidOn);
const titleOf = (item: SpendItem) =>
	item.source === "expense" ? item.title || item.merchant || m.kharcha_untitled() : m.kharcha_spend_type_payment();

const COLUMNS: ReadonlyArray<DataTableColumn<SpendItem>> = [
	{
		id: "date",
		header: () => m.kharcha_field_date(),
		sort: "date",
		cell: (item) => (
			<span className="kh-figures whitespace-nowrap">
				{formatDate(isoDateInstant(dayOf(item)), { dateStyle: "medium" })}
			</span>
		),
	},
	{
		id: "title",
		header: () => m.kharcha_field_title(),
		cell: (item) =>
			item.source === "expense" ? (
				<Link
					from="/app/kharcha/spend"
					to="."
					search={(prev) => ({ ...prev, expense: item.id })}
					mask={{ to: "/app/kharcha/e/$expenseId", params: { expenseId: item.id }, unmaskOnReload: true }}
					className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{titleOf(item)}
				</Link>
			) : (
				<span className="font-medium">{titleOf(item)}</span>
			),
	},
	{
		id: "merchant",
		header: () => m.kharcha_field_merchant(),
		hideable: true,
		cell: (item) => (item.source === "expense" ? item.merchant : ""),
	},
	{
		id: "category",
		header: () => m.kharcha_field_category(),
		hideable: true,
		cell: (item) =>
			item.source === "expense"
				? (item.category?.name ?? <span className="text-kh-muted">{m.kharcha_category_none()}</span>)
				: "",
	},
	{
		id: "people",
		header: () => m.kharcha_spend_column_people(),
		hideable: true,
		defaultHidden: true,
		cell: (item) =>
			item.people
				.filter((person) => !person.isMe)
				.map((person) => person.name)
				.join(", "),
	},
	{
		id: "receipts",
		header: () => m.kharcha_spend_column_receipts(),
		hideable: true,
		defaultHidden: true,
		cellClassName: "text-end",
		headClassName: "text-end",
		cell: (item) => (item.source === "expense" && item.receipts > 0 ? formatNumber(item.receipts) : ""),
	},
	{
		id: "total",
		header: () => m.kharcha_field_amount(),
		hideable: true,
		cellClassName: "text-end",
		headClassName: "text-end",
		cell: (item) => <Money amountMinor={item.amountMinor} currency={item.currency} />,
	},
	{
		id: "share",
		header: () => m.kharcha_spend_your_share_column(),
		sort: "amount",
		cellClassName: "text-end",
		headClassName: "text-end",
		cell: (item) =>
			item.source === "expense" ? (
				<Money
					amountMinor={item.myShareMinor}
					currency={item.currency}
					{...(item.kind === "refund" ? { tone: "owed" as const } : {})}
				/>
			) : (
				""
			),
	},
];

export default function SpendTable({
	userId,
	page,
	sort,
	lists,
}: {
	userId: string;
	page: SpendPage;
	sort: string;
	lists: KharchaLists | undefined;
}) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const bulk = useMutation(kharchaMutations.bulk(queryClient, userId));
	const run = async (ids: string[], action: BulkInput["action"], clear: () => void) => {
		try {
			const result = await bulk.mutateAsync({ ids, action });
			clear();
			toast.success(
				result.skipped > 0
					? m.kharcha_bulk_done_skipped({ count: formatNumber(result.changed), skipped: formatNumber(result.skipped) })
					: m.kharcha_bulk_done({ count: formatNumber(result.changed) }),
			);
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const remove = async (ids: string[], clear: () => void) => {
		const ok = await confirm({
			title: m.kharcha_bulk_delete_title({ count: formatNumber(ids.length) }),
			description: m.kharcha_expense_delete_body({ days: formatNumber(TRASH_DAYS) }),
			confirmLabel: m.kharcha_expense_delete(),
			destructive: true,
		});
		if (ok) await run(ids, { kind: "delete" }, clear);
	};
	const exportRows = async (ids: string[]) => {
		try {
			downloadCsv("kharcha-spend.csv", toCsv(await exportKharcha({ q: "", ids }), EXPORT_COLUMNS()));
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const categories = (lists?.categories ?? []).filter((category) => !category.archived);
	const methods = (lists?.methods ?? []).filter((method) => !method.archived);
	const tags = lists?.tags ?? [];

	return (
		<DataTable
			tableId="kharcha-spend"
			rows={page.items}
			columns={COLUMNS}
			getRowId={(item) => item.id}
			getRowLabel={titleOf}
			sort={sort}
			busy={bulk.isPending}
			data-testid="kharcha-spend-table"
			bulkActions={({ ids, clear }) => (
				<>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" data-testid="kharcha-bulk-category">
								<FolderIcon aria-hidden />
								{m.kharcha_bulk_categorize()}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{categories.map((category) => (
								<DropdownMenuItem
									key={category.id}
									onSelect={() => void run(ids, { kind: "category", categoryId: category.id }, clear)}
								>
									{category.name}
								</DropdownMenuItem>
							))}
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={() => void run(ids, { kind: "category", categoryId: null }, clear)}>
								{m.kharcha_category_none()}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{tags.length > 0 ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<TagIcon aria-hidden />
									{m.kharcha_bulk_tag()}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								{tags.map((tag) => (
									<DropdownMenuItem
										key={tag.id}
										onSelect={() => void run(ids, { kind: "tags", tagIds: [tag.id] }, clear)}
									>
										{tag.name}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<WalletIcon aria-hidden />
								{m.kharcha_bulk_method()}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{methods.map((method) => (
								<DropdownMenuItem
									key={method.id}
									onSelect={() => void run(ids, { kind: "method", methodId: method.id }, clear)}
								>
									{method.name}
								</DropdownMenuItem>
							))}
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={() => void run(ids, { kind: "method", methodId: null }, clear)}>
								{m.kharcha_spend_none_method()}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button variant="outline" size="sm" onClick={() => void exportRows(ids)}>
						<DownloadIcon aria-hidden />
						{m.kharcha_bulk_export()}
					</Button>
					<Button variant="outline" size="sm" onClick={() => void remove(ids, clear)} data-testid="kharcha-bulk-delete">
						<Trash2Icon aria-hidden />
						{m.kharcha_bulk_delete()}
					</Button>
				</>
			)}
		/>
	);
}
