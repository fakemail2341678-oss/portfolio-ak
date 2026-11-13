import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import {
	BookmarkPlusIcon,
	ChartColumnIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	DownloadIcon,
	EllipsisIcon,
	ListIcon,
	PaperclipIcon,
	PlusIcon,
	Table2Icon,
	TriangleAlertIcon,
	UploadIcon,
	XIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { FilterBar } from "@/components/filters/filter-bar";
import { SelectFilter } from "@/components/filters/filters";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Pagination } from "@/components/navigation/pagination";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { IsoMonth } from "@/lib/i18n/date-only";
import { formatMonthYear, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ExpenseCard, PaymentCard } from "../kit/cards";
import { KharchaEmpty } from "../kit/empty";
import { LedgerLine, LedgerPage } from "../kit/ledger";
import { Money } from "../kit/money";
import { kharchaLinks } from "../links";
import {
	exportKharcha,
	kharchaFriendsQueryOptions,
	kharchaGroupsQueryOptions,
	kharchaListsQueryOptions,
	kharchaMeQueryOptions,
	kharchaMerchantsQueryOptions,
	kharchaSpendQueryOptions,
} from "../queries";
import type { SpendSearch, SpendView as SpendViewName } from "../search";
import { useKharchaActions, useKharchaUserId } from "../shell/actions";
import type { SpendItem, SpendPage as SpendPageData, SpendRow } from "../types";
import { EXPORT_COLUMNS } from "./csv";
import { spendInput, spendQuery } from "./input";
import { TYPE_VALUES } from "./query/ast";
import { termProblem } from "./query/check";
import { BAR_FIELDS, COMPLEX, controlValue, foldControls, queryMonth, stepMonth, withoutTerm } from "./query/edit";
import { parseQuery } from "./query/parse";
import { printQuery, printTerm } from "./query/print";
import type { Vocabulary } from "./query/suggest";
import { QueryInput } from "./query-input";
import { type SearchLink, searchLinks, searchOf } from "./searches";

const ExpenseSheet = lazy(() => import("../expenses/expense-sheet"));
const SpendTable = lazy(() => import("./spend-table"));
const SpendChartView = lazy(() => import("./spend-chart"));
const SavedSearchDialogs = lazy(() => import("./saved-dialogs"));

const route = getRouteApi("/_kharcha/app/kharcha/_shell/spend");

const monthLabel = (month: IsoMonth) => {
	const [year, number] = month.split("-").map(Number);
	return formatMonthYear(new Date(year ?? 1970, (number ?? 1) - 1, 15));
};

/** The links a search change makes: the new `q`, the bar's no-JavaScript controls cleared, the first page. */
const withQuery = (q: string) => (prev: SpendSearch) => ({
	...prev,
	q,
	type: undefined,
	category: undefined,
	date: undefined,
	page: undefined,
});

const VIEWS: ReadonlyArray<{ view: SpendViewName; label: () => string; icon: typeof ListIcon }> = [
	{ view: "list", label: () => m.kharcha_spend_view_list(), icon: ListIcon },
	{ view: "table", label: () => m.kharcha_spend_view_table(), icon: Table2Icon },
	{ view: "chart", label: () => m.kharcha_spend_view_chart(), icon: ChartColumnIcon },
];

/**
 * Spend (PLAN Tasks 89 and 93, decision 0287): the caller's spending as a search. The
 * address holds it all: `q` in the search language, the view (a list by day, a table, a
 * chart), what the chart groups by, the order and the page. The bar's text, its chips and
 * its controls say the same thing both ways; saved searches are a click away (the rail,
 * and the page's own row on a phone). Each row opens its expense in a panel over the list
 * (a masked route: the address bar, a reload and no JavaScript give its page).
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
	const [wantsNames, setWantsNames] = useState(false);
	const { data: friends } = useQuery({ ...kharchaFriendsQueryOptions(userId), enabled: wantsNames });
	const { data: groups } = useQuery({ ...kharchaGroupsQueryOptions(userId), enabled: wantsNames });
	const { data: merchants } = useQuery({ ...kharchaMerchantsQueryOptions(userId), enabled: wantsNames });
	const { addExpense } = useKharchaActions();
	const [dialog, setDialog] = useState<"save" | "manage" | null>(null);
	const q = spendQuery(search);
	const terms = parseQuery(q);
	const links = searchLinks(me.searches);
	const current = searchOf(links, q);
	const month = queryMonth(terms, me.today.slice(0, 7));
	const ignored = terms.filter((term) => termProblem(term) !== null);
	const vocabulary: Vocabulary = {
		category: (lists?.categories ?? []).map((category) => category.name),
		tag: (lists?.tags ?? []).map((tag) => tag.name),
		method: (lists?.methods ?? []).map((method) => method.name),
		currency: me.currencies,
		group: (groups ?? []).map((group) => group.name),
		with: (friends ?? []).map((friend) => friend.nickname || friend.person.name),
		"paid-by": ["me", ...(friends ?? []).map((friend) => friend.nickname || friend.person.name)],
		merchant: (merchants ?? []).map((merchant) => merchant.merchant),
	};
	const close = () =>
		navigate({
			from: "/app/kharcha/spend",
			to: ".",
			search: (prev) => ({ ...prev, expense: undefined }),
			replace: true,
		});
	const exportCsv = async () => {
		try {
			const rows = await exportKharcha({ q });
			downloadCsv("kharcha-spend.csv", toCsv(rows, EXPORT_COLUMNS()));
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-spend">
			<header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5">
				<div className="flex min-w-0 flex-col gap-1">
					<h1 className="kh-display text-kh-title">{current?.name ?? m.kharcha_nav_spend()}</h1>
					{month ? (
						<nav aria-label={m.kharcha_spend_months()} className="flex flex-wrap items-center gap-1 text-sm">
							<MonthLink q={printQuery(stepMonth(terms, month, -1))} label={m.kharcha_spend_previous_month()}>
								<ChevronLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
							</MonthLink>
							<span className="min-w-28 text-center font-medium" aria-current="date">
								{monthLabel(month)}
							</span>
							<MonthLink q={printQuery(stepMonth(terms, month, 1))} label={m.kharcha_spend_next_month()}>
								<ChevronRightIcon className="size-4 rtl:rotate-180" aria-hidden />
							</MonthLink>
						</nav>
					) : null}
				</div>
				<div className="ms-auto flex items-center gap-2">
					{page.totals.length > 0 ? (
						<p className="me-2 flex flex-col items-end text-end" data-testid="kharcha-spend-total">
							<span className="text-caption text-kh-muted">{m.kharcha_spend_total()}</span>
							{page.totals.map((amount) => (
								<Money key={amount.currency} amountMinor={amount.amountMinor} currency={amount.currency} size="lg" />
							))}
						</p>
					) : null}
					{q !== "" && !current ? (
						<Button variant="outline" onClick={() => setDialog("save")} data-testid="kharcha-spend-save">
							<BookmarkPlusIcon aria-hidden />
							{m.kharcha_spend_save()}
						</Button>
					) : null}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" data-testid="kharcha-spend-more">
								<EllipsisIcon aria-hidden />
								<span className="sr-only">{m.kharcha_spend_more()}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => void exportCsv()} disabled={page.total === 0}>
								<DownloadIcon aria-hidden />
								{m.kharcha_spend_export()}
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link {...kharchaLinks.import()}>
									<UploadIcon aria-hidden />
									{m.kharcha_spend_import()}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => setDialog("manage")} data-testid="kharcha-spend-manage">
								<BookmarkPlusIcon aria-hidden />
								{m.kharcha_spend_manage()}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<Button onClick={() => addExpense()} className="hidden md:inline-flex" data-testid="kharcha-spend-add">
						<PlusIcon aria-hidden />
						{m.kharcha_create_expense()}
					</Button>
				</div>
			</header>

			<SavedNav links={links} current={current} place="row" />

			<div className="flex flex-1 gap-8 px-4 py-4 sm:px-8 sm:py-6">
				<SavedNav links={links} current={current} place="column" />
				<div className="flex min-w-0 flex-1 flex-col gap-4">
					<FilterBar
						values={{
							...search,
							q,
							...Object.fromEntries(BAR_FIELDS.map((field) => [field, controlValue(terms, field)])),
						}}
						preserve={["view", "groupBy", "chart", "pageSize"]}
						label={m.kharcha_spend_filters()}
						transform={(next, previous) => ({
							...next,
							q: foldControls(
								String(next.q ?? ""),
								Object.fromEntries(BAR_FIELDS.map((field) => [field, String(next[field] ?? "")])),
								String(previous.q ?? ""),
							),
							type: undefined,
							category: undefined,
							date: undefined,
						})}
					>
						<QueryInput
							value={q}
							vocabulary={vocabulary}
							onFocus={() => setWantsNames(true)}
							className="min-w-56 flex-1 basis-full sm:basis-64"
						/>
						<BarSelect
							name="type"
							label={m.kharcha_spend_filter_type()}
							terms={terms}
							options={TYPE_VALUES.map((value) => ({ value, label: TYPE_LABELS[value]() }))}
						/>
						<BarSelect
							name="category"
							label={m.kharcha_field_category()}
							terms={terms}
							options={(lists?.categories ?? []).map((category) => ({ value: category.name, label: category.name }))}
						/>
						<BarSelect
							name="date"
							label={m.kharcha_field_date()}
							terms={terms}
							options={DATE_OPTIONS.map((value) => ({ value, label: DATE_LABELS[value]() }))}
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

					{terms.length > 0 ? (
						<div className="flex flex-wrap items-center gap-2" data-testid="kharcha-spend-chips">
							<span className="text-kh-muted text-sm">{m.kharcha_spend_terms()}</span>
							<ul className="flex flex-wrap items-center gap-2">
								{terms.map((term, index) => {
									const problem = termProblem(term) !== null;
									const text = printTerm(term);
									return (
										// biome-ignore lint/suspicious/noArrayIndexKey: terms are positions in the query; the same text may repeat.
										<li key={index}>
											<Link
												from="/app/kharcha/spend"
												to="."
												search={withQuery(printQuery(withoutTerm(terms, index)))}
												aria-label={m.kharcha_spend_remove_term({ term: text })}
												className={cn(
													"kh-ease inline-flex h-7 items-center gap-1 rounded-full border ps-3 pe-2 font-mono text-[0.8125rem] outline-none hover:bg-kh-ground focus-visible:ring-[3px] focus-visible:ring-ring/50",
													problem ? "border-kh-owe border-dashed text-kh-owe" : "border-kh-hair bg-kh-page",
												)}
											>
												{problem ? <TriangleAlertIcon className="size-3.5" aria-hidden /> : null}
												<span className="kh-figures">{text}</span>
												<XIcon className="size-3.5 opacity-70" aria-hidden />
											</Link>
										</li>
									);
								})}
							</ul>
							<Link
								from="/app/kharcha/spend"
								to="."
								search={withQuery("")}
								className="rounded-sm text-sm underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
							>
								{m.filters_clear_all()}
							</Link>
						</div>
					) : null}
					{ignored.length > 0 ? (
						<output className="flex items-center gap-2 text-kh-owe text-sm" data-testid="kharcha-spend-ignored">
							<TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
							{m.kharcha_spend_ignored({ terms: ignored.map(printTerm).join(" ") })}
						</output>
					) : null}

					<nav aria-label={m.kharcha_spend_views()} className="flex items-center gap-1 border-kh-hair border-b">
						{VIEWS.map(({ view, label, icon: Icon }) => (
							<Link
								key={view}
								from="/app/kharcha/spend"
								to="."
								search={(prev) => ({ ...prev, view: view === "list" ? undefined : view, page: undefined })}
								aria-current={search.view === view ? "page" : undefined}
								className="kh-ease -mb-px inline-flex h-10 items-center gap-1.5 rounded-t-md border-transparent border-b-2 px-3 text-kh-muted text-sm outline-none hover:text-kh-ink focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:border-kh-mark aria-[current=page]:font-medium aria-[current=page]:text-kh-ink"
								data-testid={`kharcha-spend-view-${view}`}
							>
								<Icon className="size-4" aria-hidden />
								{label()}
							</Link>
						))}
					</nav>

					{search.view === "chart" ? (
						<Suspense fallback={<div className="aspect-[2/1] w-full rounded-lg bg-kh-ground sm:aspect-[5/2]" />}>
							<SpendChartView userId={userId} search={search} />
						</Suspense>
					) : page.items.length === 0 ? (
						<KharchaEmpty
							kind={q !== "" ? "search" : "spend"}
							className="rounded-lg border border-kh-hair bg-kh-page"
							action={
								q !== "" ? (
									<Button asChild variant="outline">
										<Link from="/app/kharcha/spend" to="." search={withQuery("")}>
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
					) : search.view === "table" ? (
						<Suspense fallback={<SpendList page={page} />}>
							<SpendTable userId={userId} page={page} sort={search.sort} lists={lists} />
						</Suspense>
					) : (
						<SpendList page={page} />
					)}
					{search.view === "chart" ? null : (
						<Pagination page={page.page} pageCount={page.pageCount} total={page.total} hideWhenSingle />
					)}
				</div>
			</div>

			{search.expense ? (
				<Suspense fallback={null}>
					<ExpenseSheet userId={userId} expenseId={search.expense} onClose={close} />
				</Suspense>
			) : null}
			{dialog ? (
				<Suspense fallback={null}>
					<SavedSearchDialogs
						userId={userId}
						dialog={dialog}
						query={q}
						searches={me.searches}
						onClose={() => setDialog(null)}
					/>
				</Suspense>
			) : null}
		</main>
	);
}

const TYPE_LABELS: Record<(typeof TYPE_VALUES)[number], () => string> = {
	expense: () => m.kharcha_kind_expense(),
	refund: () => m.kharcha_kind_refund(),
	payment: () => m.kharcha_spend_type_payment(),
};

const DATE_OPTIONS = ["today", "this-week", "this-month", "last-month", "this-year"] as const;
const DATE_LABELS: Record<(typeof DATE_OPTIONS)[number], () => string> = {
	today: () => m.kharcha_spend_date_today(),
	"this-week": () => m.kharcha_spend_date_this_week(),
	"this-month": () => m.kharcha_spend_this_month(),
	"last-month": () => m.kharcha_spend_date_last_month(),
	"this-year": () => m.kharcha_spend_date_this_year(),
};

/**
 * One of the bar's controls: it shows what the query says of its field ("Any" when nothing,
 * "As searched" when more than one value can), and setting it rewrites that field in `q`.
 */
function BarSelect({
	name,
	label,
	terms,
	options,
}: {
	name: (typeof BAR_FIELDS)[number];
	label: string;
	terms: ReturnType<typeof parseQuery>;
	options: ReadonlyArray<{ value: string; label: string }>;
}) {
	const shown = controlValue(terms, name);
	const known = options.find((option) => option.value.toLocaleLowerCase() === shown.toLocaleLowerCase());
	const value = known?.value ?? shown;
	return (
		<SelectFilter
			name={name}
			label={label}
			value={value}
			options={[
				{ value: "", label: m.filters_any() },
				...(shown === COMPLEX ? [{ value: COMPLEX, label: m.kharcha_spend_as_searched() }] : []),
				...(shown !== "" && shown !== COMPLEX && !known ? [{ value: shown, label: shown }] : []),
				...options,
			]}
		/>
	);
}

/**
 * The saved searches, built-in ones first: Spend's own nav (the rail is a column of icons),
 * a column beside the results on a laptop and a row of links on a phone.
 */
function SavedNav({
	links,
	current,
	place,
}: {
	links: ReadonlyArray<SearchLink>;
	current: SearchLink | undefined;
	place: "row" | "column";
}) {
	const column = place === "column";
	return (
		<nav
			aria-label={m.kharcha_spend_saved()}
			className={column ? "hidden w-48 shrink-0 md:block" : "border-kh-hair border-b bg-kh-page md:hidden"}
			data-testid={`kharcha-saved-${place}`}
		>
			{column ? <h2 className="mb-2 px-2 text-caption text-kh-muted">{m.kharcha_spend_saved()}</h2> : null}
			<ul className={column ? "flex flex-col gap-0.5" : "flex gap-2 overflow-x-auto px-4 py-2"}>
				{links.map((link) => (
					<li key={link.key} className={column ? undefined : "shrink-0"}>
						<Link
							from="/app/kharcha/spend"
							to="."
							search={withQuery(link.query)}
							aria-current={link === current ? "page" : undefined}
							className={cn(
								"kh-ease outline-none hover:bg-kh-ground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:text-kh-mark",
								column
									? "flex min-h-9 items-center rounded-md px-2 text-sm aria-[current=page]:bg-kh-ground aria-[current=page]:font-medium"
									: "inline-flex h-8 items-center rounded-full border border-kh-hair px-3 text-sm aria-[current=page]:border-kh-mark",
							)}
						>
							<span className="truncate">{link.name}</span>
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

/** A month step: the query with its month moved, from the first page. */
function MonthLink({ q, label, children }: { q: string; label: string; children: React.ReactNode }) {
	return (
		<Link
			from="/app/kharcha/spend"
			to="."
			search={withQuery(q)}
			className="kh-ease grid size-9 place-items-center rounded-md outline-none hover:bg-kh-ground focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			{children}
			<span className="sr-only">{label}</span>
		</Link>
	);
}

/** The list view: the page's rows by day, each day in the margin once. */
function SpendList({ page }: { page: SpendPageData }) {
	return (
		<section
			aria-label={m.kharcha_spend_list({ count: formatNumber(page.total) })}
			className="overflow-hidden rounded-lg border border-kh-hair"
		>
			<LedgerPage>
				{page.items.map((item, index) => {
					const previous = page.items[index - 1];
					const day = item.source === "expense" ? item.spentOn : item.paidOn;
					const before = previous ? (previous.source === "expense" ? previous.spentOn : previous.paidOn) : null;
					return <SpendLine key={item.id} item={item} {...(before === day ? {} : { day })} />;
				})}
			</LedgerPage>
		</section>
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

/** One line on the page: an expense's card and its receipts, or a payment's card. */
function SpendLine({ item, day }: { item: SpendItem; day?: string }) {
	if (item.source === "payment") {
		return (
			<LedgerLine {...(day ? { day } : {})}>
				<div data-testid="kharcha-spend-row">
					<PaymentCard payment={item} />
				</div>
			</LedgerLine>
		);
	}
	return (
		<LedgerLine {...(day ? { day } : {})}>
			<div className="flex items-center gap-2" data-testid="kharcha-spend-row">
				<ExpenseCard
					expense={item}
					category={item.category?.icon ?? null}
					{...(item.category ? { categoryColor: item.category.color } : {})}
					fixes={item.fixes}
					aside={<ShareAside row={item} />}
					className="min-w-0 flex-1"
					link={({ className, children }) => (
						<Link
							from="/app/kharcha/spend"
							to="."
							search={(prev) => ({ ...prev, expense: item.id })}
							mask={{ to: "/app/kharcha/e/$expenseId", params: { expenseId: item.id }, unmaskOnReload: true }}
							className={className}
						>
							{children}
						</Link>
					)}
				/>
				{item.receipts > 0 ? (
					<span className="flex shrink-0 items-center gap-0.5 text-caption text-kh-muted">
						<PaperclipIcon className="size-3.5" aria-hidden />
						<span className="kh-figures">{formatNumber(item.receipts)}</span>
						<span className="sr-only">{m.kharcha_spend_receipts({ count: formatNumber(item.receipts) })}</span>
					</span>
				) : null}
			</div>
		</LedgerLine>
	);
}
