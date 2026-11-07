import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation } from "@tanstack/react-router";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	DownloadIcon,
	FileUpIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PieChartIcon,
	PlusIcon,
	ReceiptIcon,
	TagsIcon,
	TargetIcon,
	Trash2Icon,
	WalletIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { BarChart, DonutChart } from "@/components/charts";
import { StatCard } from "@/components/data-display/stat-card";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { exportExpenses } from "@/functions/apps/expenses";
import { downloadCsv, toCsv } from "@/lib/csv";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatMonthShort, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { appColor } from "../../colors";
import { TryAppButton } from "../../components/try-app-button";
import { csvAmount, formatMoney, formatMonth, formatWholeMoney, monthNeighbours } from "../format";
import { expenseMutations, expensesMonthQueryOptions } from "../queries";
import type { ExpensesSearch } from "../search";
import {
	type BudgetProgress,
	EXPENSE_CURRENCIES,
	type ExpenseCategory,
	type ExpenseExportRow,
	type ExpenseItem,
	type ExpensesMonth,
	toMajor,
} from "../types";
import { CategoryIconMark, CategoryLabel } from "./category-label";

const ExpenseDialog = lazy(() => import("./expense-dialog"));
const BudgetDialog = lazy(() => import("./budget-dialog"));

const route = getRouteApi("/_apps/apps/expenses/");

/**
 * /apps/expenses (decision 0192): the app's landing for a visitor, the user's month of
 * spending once they have a session (a guest's included). The landing is what search
 * engines see.
 */
export function ExpensesHome() {
	const { session } = route.useRouteContext();
	return session ? <ExpensesDashboard userId={session.user.id} /> : <ExpensesLanding />;
}

function ExpensesLanding() {
	const location = useLocation();
	const features = [
		{ icon: PieChartIcon, title: m.expenses_feature_charts(), body: m.expenses_feature_charts_body() },
		{ icon: TargetIcon, title: m.expenses_feature_budgets(), body: m.expenses_feature_budgets_body() },
		{ icon: FileUpIcon, title: m.expenses_feature_csv(), body: m.expenses_feature_csv_body() },
	];
	return (
		<Page width="wide" data-testid="expenses-landing">
			<div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,28rem)]">
				<div className="flex flex-col gap-6">
					<PageHeader size="display" title={m.expenses_name()} description={m.expenses_description()} />
					<div className="flex flex-wrap items-center gap-3">
						<TryAppButton />
						<Button asChild variant="outline" size="lg">
							<Link to="/login" search={{ redirect: location.href }}>
								{m.apps_sign_in_to_use()}
							</Link>
						</Button>
					</div>
					<p className="max-w-prose text-muted-foreground text-sm">
						{m.apps_guest_note({ days: formatNumber(GUEST_LIFETIME_DAYS) })}
					</p>
				</div>
				<ExpensesPreview />
			</div>
			<section aria-labelledby="expenses-features" className="flex flex-col gap-4">
				<h2 id="expenses-features" className="text-heading">
					{m.expenses_features_title()}
				</h2>
				<ul className="grid gap-4 sm:grid-cols-3">
					{features.map(({ icon: Icon, title, body }) => (
						<li key={title} className="flex flex-col gap-2 rounded-lg border bg-surface-1 p-4">
							<Icon className="size-5 text-primary" aria-hidden />
							<h3 className="font-medium text-body">{title}</h3>
							<p className="text-muted-foreground text-sm">{body}</p>
						</li>
					))}
				</ul>
			</section>
		</Page>
	);
}

/** A still picture of a month's budgets (decorative: the text beside it says what the app does). */
function ExpensesPreview() {
	const rows = [
		{ name: m.expenses_seed_food(), color: appColor("orange"), share: 0.72 },
		{ name: m.expenses_seed_transport(), color: appColor("blue"), share: 0.46 },
		{ name: m.expenses_seed_fun(), color: appColor("violet"), share: 0.9 },
	];
	return (
		<div aria-hidden className="flex flex-col gap-3 rounded-xl border bg-surface-1 p-4 shadow-sm">
			<div className="flex items-baseline justify-between rounded-lg border bg-background p-3">
				<span className="text-caption text-muted-foreground">{m.expenses_spent()}</span>
				<span className="font-semibold text-title tabular-nums">{formatWholeMoney(24_350, "NPR")}</span>
			</div>
			{rows.map((row) => (
				<div key={row.name} className="flex flex-col gap-1.5 rounded-lg border bg-background p-3">
					<span className="text-caption">{row.name}</span>
					<span className="h-1.5 rounded-full bg-surface-2">
						<span
							className="block h-full rounded-full"
							style={{ width: `${row.share * 100}%`, backgroundColor: row.color }}
						/>
					</span>
				</div>
			))}
		</div>
	);
}

type Editing = { kind: "expense"; expense?: ExpenseItem } | { kind: "budget"; budget?: BudgetProgress } | null;

const EXPORT_COLUMNS = () => [
	{ header: m.expenses_csv_date(), value: (row: ExpenseExportRow) => row.occurredOn },
	{ header: m.expenses_csv_amount(), value: (row: ExpenseExportRow) => csvAmount(row.amountMinor) },
	{ header: m.expenses_csv_currency(), value: (row: ExpenseExportRow) => row.currency },
	{ header: m.expenses_csv_category(), value: (row: ExpenseExportRow) => row.category },
	{ header: m.expenses_csv_note(), value: (row: ExpenseExportRow) => row.note },
];

function ExpensesDashboard({ userId }: { userId: string }) {
	const search = route.useSearch();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { data } = useSuspenseQuery(expensesMonthQueryOptions(userId, search.month, search.currency));
	const create = useMutation(expenseMutations.create(queryClient, userId));
	const update = useMutation(expenseMutations.update(queryClient, userId));
	const remove = useMutation(expenseMutations.delete(queryClient, userId));
	const setBudget = useMutation(expenseMutations.setBudget(queryClient, userId));
	const [editing, setEditing] = useState<Editing>(null);
	const [exporting, setExporting] = useState(false);
	const categories = new Map(data.categories.map((category) => [category.id, category]));
	const categoryOf = (id: string | null) => (id ? (categories.get(id) ?? null) : null);
	const budgeted = data.budgets.reduce((sum, budget) => sum + budget.amountMinor, 0);

	const removeExpense = async (expense: ExpenseItem) => {
		const label = expense.note || formatMoney(expense.amountMinor, expense.currency);
		const confirmed = await confirm({
			title: m.crud_delete_title({ label }),
			description: m.expenses_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		remove.mutate(expense.id, {
			onSuccess: () => toast.success(m.crud_toast_deleted({ label })),
			onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
		});
	};

	const removeBudget = async (budget: BudgetProgress) => {
		const name = categoryOf(budget.categoryId)?.name ?? "";
		const confirmed = await confirm({
			title: m.expenses_budget_remove_title({ category: name }),
			description: m.expenses_budget_remove_body(),
			confirmLabel: m.expenses_budget_remove(),
			destructive: true,
		});
		if (!confirmed) return;
		setBudget.mutate(
			{ categoryId: budget.categoryId, month: data.month, currency: data.currency, amountMinor: null },
			{
				onSuccess: () => toast.success(m.expenses_toast_budget_removed()),
				onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
			},
		);
	};

	const exportCsv = async () => {
		setExporting(true);
		try {
			const rows = await exportExpenses();
			downloadCsv(`expenses-${data.today}.csv`, toCsv(rows, EXPORT_COLUMNS()));
		} catch (error) {
			toast.error(m.common_toast_failed(), { description: errorMessage(error) });
		} finally {
			setExporting(false);
		}
	};

	const addButton = (
		<Button onClick={() => setEditing({ kind: "expense" })} data-testid="expenses-add">
			<PlusIcon aria-hidden />
			{m.expenses_add()}
		</Button>
	);

	return (
		<Page width="wide" data-testid="expenses-dashboard">
			<PageHeader
				title={m.expenses_title()}
				description={m.expenses_month_description({ month: formatMonth(data.month), currency: data.currency })}
				actions={
					<>
						{addButton}
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon" aria-label={m.expenses_more()} data-testid="expenses-more">
									<MoreHorizontalIcon aria-hidden />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem asChild>
									<Link to="/apps/expenses/import">
										<FileUpIcon aria-hidden />
										{m.expenses_import()}
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => void exportCsv()} disabled={exporting} data-testid="expenses-export">
									<DownloadIcon aria-hidden />
									{m.expenses_export()}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link to="/apps/expenses/categories">
										<TagsIcon aria-hidden />
										{m.expenses_categories_title()}
									</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				}
			/>
			<MonthBar data={data} search={search} />
			<section aria-labelledby="expenses-stats" className="grid gap-4 sm:grid-cols-3">
				<h2 id="expenses-stats" className="sr-only">
					{m.dashboard_stats_title()}
				</h2>
				<StatCard
					label={m.expenses_spent()}
					value={toMajor(data.totalMinor)}
					format={(value) => formatWholeMoney(value, data.currency)}
					icon={WalletIcon}
				/>
				<StatCard
					label={m.expenses_budgeted()}
					value={toMajor(budgeted)}
					format={(value) => formatWholeMoney(value, data.currency)}
					icon={TargetIcon}
					hint={
						budgeted === 0
							? m.expenses_no_budgets_short()
							: budgeted >= data.totalMinor
								? m.expenses_left({ amount: formatMoney(budgeted - data.totalMinor, data.currency) })
								: m.expenses_over({ amount: formatMoney(data.totalMinor - budgeted, data.currency) })
					}
				/>
				<StatCard label={m.expenses_count_label()} value={data.expenses.length} icon={ReceiptIcon} />
			</section>
			<div className="grid gap-6 lg:grid-cols-2">
				<SpendingByCategory data={data} categoryOf={categoryOf} />
				<section aria-labelledby="expenses-trend" className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
					<h2 id="expenses-trend" className="text-heading">
						{m.expenses_trend_title()}
					</h2>
					<BarChart
						label={m.expenses_trend_label({ currency: data.currency })}
						data={data.trend.map((each) => ({
							month: formatMonthShort(each.month),
							amount: toMajor(each.amountMinor),
						}))}
						index="month"
						series={[{ key: "amount", label: m.expenses_spent() }]}
						format={(value) => formatWholeMoney(value, data.currency)}
					/>
				</section>
			</div>
			<Budgets
				data={data}
				categoryOf={categoryOf}
				onSet={() => setEditing({ kind: "budget" })}
				onEdit={(budget) => setEditing({ kind: "budget", budget })}
				onRemove={(budget) => void removeBudget(budget)}
			/>
			<section aria-labelledby="expenses-list" className="flex flex-col gap-3">
				<h2 id="expenses-list" className="text-heading">
					{m.expenses_list_title({ month: formatMonth(data.month) })}
				</h2>
				{data.expenses.length === 0 ? (
					<EmptyState
						icon={ReceiptIcon}
						title={m.expenses_empty_title()}
						description={m.expenses_empty_body()}
						primaryAction={addButton}
						secondaryAction={
							<Button asChild variant="outline">
								<Link to="/apps/expenses/import">
									<FileUpIcon aria-hidden />
									{m.expenses_import()}
								</Link>
							</Button>
						}
					/>
				) : (
					<ul className="flex flex-col divide-y rounded-lg border bg-surface-1" data-testid="expenses-rows">
						{data.expenses.map((expense) => {
							const category = categoryOf(expense.categoryId);
							return (
								<li key={expense.id} className="flex items-center gap-3 p-3" data-testid="expenses-row">
									<CategoryIconMark category={category} />
									<div className="flex min-w-0 flex-1 flex-col">
										<span className="truncate font-medium text-sm">
											{expense.note || category?.name || m.expenses_uncategorized()}
										</span>
										<span className="truncate text-caption text-muted-foreground">
											{formatDate(isoDateInstant(expense.occurredOn), { dateStyle: "medium" })}
											{" · "}
											{category?.name ?? m.expenses_uncategorized()}
										</span>
									</div>
									<span className="shrink-0 font-medium text-sm tabular-nums">
										{formatMoney(expense.amountMinor, expense.currency)}
									</span>
									<DropdownMenu modal={false}>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												aria-label={m.expenses_actions({
													label: expense.note || formatMoney(expense.amountMinor, expense.currency),
												})}
											>
												<MoreHorizontalIcon aria-hidden />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => setEditing({ kind: "expense", expense })}>
												<PencilIcon aria-hidden />
												{m.expenses_edit()}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem variant="destructive" onSelect={() => void removeExpense(expense)}>
												<Trash2Icon aria-hidden />
												{m.crud_delete()}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</li>
							);
						})}
					</ul>
				)}
			</section>
			<Suspense fallback={null}>
				{editing?.kind === "expense" ? (
					<ExpenseDialog
						expense={editing.expense}
						categories={data.categories}
						today={data.today}
						defaultCurrency={data.currency}
						onSubmit={async (values) => {
							if (editing.expense) {
								await update.mutateAsync({ id: editing.expense.id, ...values });
								toast.success(m.crud_toast_saved());
							} else {
								await create.mutateAsync({ id: crypto.randomUUID(), ...values });
								toast.success(m.expenses_toast_added());
							}
						}}
						onClose={() => setEditing(null)}
					/>
				) : editing?.kind === "budget" ? (
					<BudgetDialog
						budget={editing.budget}
						categories={data.categories}
						month={data.month}
						currency={data.currency}
						onSubmit={async (values) => {
							await setBudget.mutateAsync({ ...values, month: data.month, currency: data.currency });
							toast.success(m.expenses_toast_budget_saved());
						}}
						onClose={() => setEditing(null)}
					/>
				) : null}
			</Suspense>
		</Page>
	);
}

/** The month on screen with links to the one before and after, and the currency switch. */
function MonthBar({ data, search }: { data: ExpensesMonth; search: ExpensesSearch }) {
	const current = data.today.slice(0, 7);
	const { previous, next } = monthNeighbours(data.month, current);
	const linkClass =
		"inline-flex size-8 items-center justify-center rounded-md border outline-none transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50";
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<nav aria-label={m.expenses_months()} className="flex items-center gap-2">
				<Link
					to="/apps/expenses"
					search={{ ...search, month: previous }}
					className={linkClass}
					aria-label={m.expenses_month_previous({ month: formatMonth(previous) })}
				>
					<ChevronLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
				</Link>
				<span className="min-w-36 text-center font-medium text-body" aria-current="date">
					{formatMonth(data.month)}
				</span>
				{next ? (
					<Link
						to="/apps/expenses"
						search={{ ...search, month: next === current ? undefined : next }}
						className={linkClass}
						aria-label={m.expenses_month_next({ month: formatMonth(next) })}
					>
						<ChevronRightIcon className="size-4 rtl:rotate-180" aria-hidden />
					</Link>
				) : (
					<span className={cn(linkClass, "pointer-events-none opacity-40")} aria-hidden>
						<ChevronRightIcon className="size-4 rtl:rotate-180" />
					</span>
				)}
			</nav>
			<nav aria-label={m.expenses_currency_label()} className="flex items-center gap-1 rounded-md border p-0.5">
				{EXPENSE_CURRENCIES.map((code) => (
					<Link
						key={code}
						to="/apps/expenses"
						search={{ ...search, currency: code }}
						aria-current={code === data.currency ? "page" : undefined}
						className={cn(
							"rounded-sm px-2.5 py-1 font-medium text-sm outline-none transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50",
							code === data.currency ? "bg-surface-2 text-foreground" : "text-muted-foreground",
						)}
					>
						{code}
					</Link>
				))}
			</nav>
		</div>
	);
}

function SpendingByCategory({
	data,
	categoryOf,
}: {
	data: ExpensesMonth;
	categoryOf: (id: string | null) => ExpenseCategory | null;
}) {
	const rows = data.byCategory.map((row) => {
		const category = categoryOf(row.categoryId);
		return {
			category: category?.name ?? m.expenses_uncategorized(),
			amount: toMajor(row.amountMinor),
			color: category ? appColor(category.color) : "var(--muted-foreground)",
		};
	});
	return (
		<section aria-labelledby="expenses-by-category" className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
			<h2 id="expenses-by-category" className="text-heading">
				{m.expenses_by_category_title()}
			</h2>
			{rows.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.expenses_no_spending({ currency: data.currency })}</p>
			) : (
				<div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
					<DonutChart
						label={m.expenses_by_category_label({ month: formatMonth(data.month), currency: data.currency })}
						data={rows.map(({ category, amount }) => ({ category, amount }))}
						index="category"
						series={[{ key: "amount", label: m.expenses_spent() }]}
						colors={rows.map((row) => row.color)}
						format={(value) => formatWholeMoney(value, data.currency)}
					/>
					<ul className="flex min-w-0 flex-col gap-2" aria-hidden>
						{rows.map((row) => (
							<li key={row.category} className="flex items-center gap-2 text-sm">
								<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
								<span className="min-w-0 flex-1 truncate">{row.category}</span>
								<span className="text-muted-foreground tabular-nums">
									{formatWholeMoney(row.amount, data.currency)}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}

function Budgets({
	data,
	categoryOf,
	onSet,
	onEdit,
	onRemove,
}: {
	data: ExpensesMonth;
	categoryOf: (id: string | null) => ExpenseCategory | null;
	onSet: () => void;
	onEdit: (budget: BudgetProgress) => void;
	onRemove: (budget: BudgetProgress) => void;
}) {
	const budgets = [...data.budgets].sort((a, b) =>
		(categoryOf(a.categoryId)?.name ?? "").localeCompare(categoryOf(b.categoryId)?.name ?? ""),
	);
	const free = data.categories.filter((category) => !data.budgets.some((budget) => budget.categoryId === category.id));
	return (
		<section aria-labelledby="expenses-budgets" className="flex flex-col gap-3 rounded-lg border p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="expenses-budgets" className="text-heading">
					{m.expenses_budgets_title()}
				</h2>
				<Button variant="outline" size="sm" onClick={onSet} disabled={free.length === 0} data-testid="budgets-set">
					<TargetIcon aria-hidden />
					{m.expenses_budget_set()}
				</Button>
			</div>
			{budgets.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{m.expenses_no_budgets({ month: formatMonth(data.month), currency: data.currency })}
				</p>
			) : (
				<ul className="grid gap-4 md:grid-cols-2" data-testid="budgets-list">
					{budgets.map((budget) => {
						const category = categoryOf(budget.categoryId);
						const over = budget.spentMinor > budget.amountMinor;
						const percent = Math.min(100, Math.round((budget.spentMinor / budget.amountMinor) * 100));
						const name = category?.name ?? "";
						return (
							<li key={budget.categoryId} className="flex flex-col gap-2">
								<div className="flex items-center gap-2">
									<CategoryLabel category={category} className="min-w-0 flex-1 font-medium text-sm" />
									<DropdownMenu modal={false}>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="size-7"
												aria-label={m.expenses_budget_actions({ category: name })}
											>
												<MoreHorizontalIcon aria-hidden />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => onEdit(budget)}>
												<PencilIcon aria-hidden />
												{m.expenses_budget_change()}
											</DropdownMenuItem>
											<DropdownMenuItem variant="destructive" onSelect={() => onRemove(budget)}>
												<Trash2Icon aria-hidden />
												{m.expenses_budget_remove()}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
								<Progress
									value={percent}
									aria-label={m.expenses_budget_progress({ category: name })}
									aria-valuetext={m.expenses_budget_of({
										spent: formatMoney(budget.spentMinor, data.currency),
										budget: formatMoney(budget.amountMinor, data.currency),
									})}
									className={cn(over && "[&_[data-slot=progress-indicator]]:bg-danger")}
								/>
								<p className="flex flex-wrap justify-between gap-x-3 text-caption">
									<span className="text-muted-foreground tabular-nums">
										{m.expenses_budget_of({
											spent: formatMoney(budget.spentMinor, data.currency),
											budget: formatMoney(budget.amountMinor, data.currency),
										})}
									</span>
									<span className={cn("font-medium tabular-nums", over ? "text-danger" : "text-muted-foreground")}>
										{over
											? m.expenses_over({ amount: formatMoney(budget.spentMinor - budget.amountMinor, data.currency) })
											: m.expenses_left({ amount: formatMoney(budget.amountMinor - budget.spentMinor, data.currency) })}
									</span>
								</p>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
