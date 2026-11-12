import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { FilterBar } from "@/components/filters/filter-bar";
import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Pagination } from "@/components/navigation/pagination";
import { Button } from "@/components/ui/button";
import { addMonths, type IsoMonth } from "@/lib/i18n/date-only";
import { formatMonthYear, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ExpenseCard } from "../kit/cards";
import { KharchaEmpty } from "../kit/empty";
import { LedgerLine, LedgerPage } from "../kit/ledger";
import { Money } from "../kit/money";
import { kharchaListsQueryOptions, kharchaMeQueryOptions, kharchaSpendQueryOptions } from "../queries";
import type { SpendSearch } from "../search";
import { useKharchaActions, useKharchaUserId } from "../shell/actions";
import type { SpendRow } from "../types";
import { spendInput } from "./input";

const ExpenseSheet = lazy(() => import("../expenses/expense-sheet"));
const route = getRouteApi("/_kharcha/app/kharcha/_shell/spend");

const monthLabel = (month: IsoMonth) => {
	const [year, number] = month.split("-").map(Number);
	return formatMonthYear(new Date(year ?? 1970, (number ?? 1) - 1, 15));
};

/**
 * Spend (PLAN Task 89, "a first /spend"): the caller's expenses, this month by default,
 * newest first, on the URL list contract: the month, a search, a category, the order and
 * the page are all in the address. Each row opens its expense in a panel over the list (a
 * masked route: the address bar, a reload and no JavaScript give its page). Task 93 adds
 * the search language, saved searches and the other views.
 */
export function SpendPage() {
	return <SpendView search={route.useSearch()} />;
}

/** Spend for a given URL (the route's, or a story's). */
export function SpendView({ search }: { search: SpendSearch }) {
	const userId = useKharchaUserId();
	const navigate = useNavigate();
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const { data: page } = useSuspenseQuery(kharchaSpendQueryOptions(userId, spendInput(search)));
	const { data: lists } = useQuery(kharchaListsQueryOptions(userId));
	const { addExpense } = useKharchaActions();
	const month = search.month ?? (me.today.slice(0, 7) as IsoMonth);
	const filtered = search.q !== "" || search.category.length > 0;
	const step = (by: number) => (month === "all" ? undefined : addMonths(month, by));
	const close = () =>
		navigate({
			from: "/app/kharcha/spend",
			to: ".",
			search: (prev) => ({ ...prev, expense: undefined }),
			replace: true,
		});

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-spend">
			<header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5">
				<div className="flex min-w-0 flex-col gap-1">
					<h1 className="kh-display text-kh-title">{m.kharcha_nav_spend()}</h1>
					<nav aria-label={m.kharcha_spend_months()} className="flex flex-wrap items-center gap-1 text-sm">
						{month === "all" ? (
							<span className="font-medium">{m.kharcha_spend_all_time()}</span>
						) : (
							<>
								<MonthLink month={step(-1)} label={m.kharcha_spend_previous_month()}>
									<ChevronLeftIcon className="size-4" aria-hidden />
								</MonthLink>
								<span className="min-w-28 text-center font-medium" aria-current="date">
									{monthLabel(month)}
								</span>
								<MonthLink month={step(1)} label={m.kharcha_spend_next_month()}>
									<ChevronRightIcon className="size-4" aria-hidden />
								</MonthLink>
							</>
						)}
						<Link
							from="/app/kharcha/spend"
							to="."
							search={(prev) => ({ ...prev, month: month === "all" ? undefined : "all", page: undefined })}
							className="ms-2 rounded-sm text-kh-mark underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							{month === "all" ? m.kharcha_spend_this_month() : m.kharcha_spend_all_time()}
						</Link>
					</nav>
				</div>
				<div className="ms-auto flex items-center gap-3">
					{page.totals.length > 0 ? (
						<p className="flex flex-col items-end text-end" data-testid="kharcha-spend-total">
							<span className="text-caption text-kh-muted">{m.kharcha_spend_total()}</span>
							{page.totals.map((amount) => (
								<Money key={amount.currency} amountMinor={amount.amountMinor} currency={amount.currency} size="lg" />
							))}
						</p>
					) : null}
					<Button onClick={() => addExpense()} className="hidden md:inline-flex" data-testid="kharcha-spend-add">
						<PlusIcon aria-hidden />
						{m.kharcha_create_expense()}
					</Button>
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-8 sm:py-6">
				<FilterBar values={search} preserve={["month", "sort", "pageSize"]} label={m.kharcha_spend_filters()}>
					<SearchFilter
						label={m.kharcha_spend_search()}
						placeholder={m.kharcha_spend_search()}
						value={search.q}
						hideLabel
						className="min-w-48 flex-1"
					/>
					<SelectFilter
						name="category"
						label={m.kharcha_field_category()}
						value={search.category[0] ?? ""}
						options={[
							{ value: "", label: m.filters_any() },
							{ value: "none", label: m.kharcha_category_none() },
							...(lists?.categories ?? []).map((category) => ({ value: category.id, label: category.name })),
						]}
					/>
					<SelectFilter
						name="sort"
						label={m.kharcha_spend_sort()}
						value={search.sort}
						options={[
							{ value: "-date", label: m.kharcha_spend_sort_newest() },
							{ value: "date", label: m.kharcha_spend_sort_oldest() },
							{ value: "-amount", label: m.kharcha_spend_sort_largest() },
							{ value: "amount", label: m.kharcha_spend_sort_smallest() },
						]}
					/>
				</FilterBar>

				{page.items.length === 0 ? (
					<KharchaEmpty
						kind={filtered ? "search" : "spend"}
						className="rounded-lg border border-kh-hair bg-kh-page"
						action={
							filtered ? (
								<Button asChild variant="outline">
									<Link
										from="/app/kharcha/spend"
										to="."
										search={(prev) => ({ ...prev, q: "", category: [], page: undefined })}
									>
										{m.filters_clear()}
									</Link>
								</Button>
							) : (
								<Button onClick={() => addExpense()}>
									<PlusIcon aria-hidden />
									{m.kharcha_create_expense()}
								</Button>
							)
						}
					/>
				) : (
					<section
						aria-label={m.kharcha_spend_list({ count: formatNumber(page.total) })}
						className="overflow-hidden rounded-lg border border-kh-hair"
					>
						<LedgerPage>
							{page.items.map((row, index) => (
								<SpendLine key={row.id} row={row} previous={page.items[index - 1]} />
							))}
						</LedgerPage>
					</section>
				)}
				<Pagination page={page.page} pageCount={page.pageCount} total={page.total} hideWhenSingle />
			</div>

			{search.expense ? (
				<Suspense fallback={null}>
					<ExpenseSheet userId={userId} expenseId={search.expense} onClose={close} />
				</Suspense>
			) : null}
		</main>
	);
}

/** A month step: a link that keeps the filters and goes back to the first page. */
function MonthLink({
	month,
	label,
	children,
}: {
	month: IsoMonth | undefined;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			from="/app/kharcha/spend"
			to="."
			search={(prev) => ({ ...prev, month, page: undefined })}
			className="kh-ease grid size-9 place-items-center rounded-md outline-none hover:bg-kh-ground focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			{children}
			<span className="sr-only">{label}</span>
		</Link>
	);
}

/** What a row counts on Spend: the caller's share, a refund against it, said in words as well. */
function ShareAside({ row }: { row: SpendRow }) {
	const refund = row.kind === "refund";
	const shared = row.people.length > 1;
	return (
		<p className="flex flex-col items-end text-end">
			<Money amountMinor={row.myShareMinor} currency={row.currency} {...(refund ? { tone: "owed" as const } : {})} />
			{refund || shared ? (
				<span className={refund ? "font-medium text-[0.75rem] text-kh-owed" : "text-[0.75rem] text-kh-muted"}>
					{refund ? m.kharcha_spend_refund() : m.kharcha_spend_your_share()}
				</span>
			) : null}
		</p>
	);
}

/** One expense on the page: its day in the margin (once per day), the card, how many receipts. */
function SpendLine({ row, previous }: { row: SpendRow; previous: SpendRow | undefined }) {
	return (
		<LedgerLine {...(previous?.spentOn === row.spentOn ? {} : { day: row.spentOn })}>
			<div className="flex items-center gap-2" data-testid="kharcha-spend-row">
				<ExpenseCard
					expense={row}
					category={row.category?.icon ?? null}
					{...(row.category ? { categoryColor: row.category.color } : {})}
					fixes={row.fixes}
					aside={<ShareAside row={row} />}
					className="min-w-0 flex-1"
					link={({ className, children }) => (
						<Link
							from="/app/kharcha/spend"
							to="."
							search={(prev) => ({ ...prev, expense: row.id })}
							mask={{ to: "/app/kharcha/e/$expenseId", params: { expenseId: row.id }, unmaskOnReload: true }}
							className={className}
						>
							{children}
						</Link>
					)}
				/>
				{row.receipts > 0 ? (
					<span className="flex shrink-0 items-center gap-0.5 text-caption text-kh-muted">
						<PaperclipIcon className="size-3.5" aria-hidden />
						<span className="kh-figures">{formatNumber(row.receipts)}</span>
						<span className="sr-only">{m.kharcha_spend_receipts({ count: formatNumber(row.receipts) })}</span>
					</span>
				) : null}
			</div>
		</LedgerLine>
	);
}
