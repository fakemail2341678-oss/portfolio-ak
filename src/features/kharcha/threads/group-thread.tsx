import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArchiveIcon, PlusIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { GROUP_KIND_LABELS } from "../groups/labels";
import { KharchaEmpty } from "../kit/empty";
import { GroupPlate } from "../kit/group-plate";
import { BalancePill } from "../kit/money";
import { kharchaGroupThreadQueryOptions } from "../queries";
import type { GroupTab, ThreadSearch } from "../search";
import { useKharchaActions, useKharchaUserId } from "../shell/actions";
import type { GroupView } from "../types";
import { ThreadLines } from "./thread-lines";

const ExpenseSheet = lazy(() => import("../expenses/expense-sheet"));
const GroupSettings = lazy(() => import("../groups/group-settings"));
const route = getRouteApi("/_kharcha/app/kharcha/_shell/g/$groupId");

/**
 * A group's page (Task 90): its header (the plate, the name, the caller's balance in it,
 * one primary action: Add expense), the thread or the settings by `?tab=`, and the expense
 * panel over it. A former member reads the history up to leaving; an archived group takes
 * nothing new.
 */
export function GroupThreadPage() {
	const { groupId } = route.useParams();
	return <GroupThreadView groupId={groupId} search={route.useSearch()} />;
}

/** The group's page for given params (the route's, or a story's). */
export function GroupThreadView({ groupId, search }: { groupId: string; search: ThreadSearch }) {
	const userId = useKharchaUserId();
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(kharchaGroupThreadQueryOptions(userId, groupId));
	const { addExpense } = useKharchaActions();
	const { group } = data;
	const close = () =>
		navigate({
			from: "/app/kharcha/g/$groupId",
			to: ".",
			search: (prev) => ({ ...prev, expense: undefined }),
			replace: true,
		});
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-group">
			<header className="flex flex-col gap-3 border-kh-hair border-b bg-kh-page px-4 pt-4 sm:px-8 md:pt-5">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
					<GroupPlate icon={group.icon} color={group.color} size="lg" />
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<h1 className="kh-display truncate text-kh-title">{group.name}</h1>
						<p className="truncate text-caption text-kh-muted">{groupLine(group)}</p>
					</div>
					<div className="flex items-center gap-3">
						<BalancePill balances={group.balances} />
						{group.can.edit ? (
							<Button onClick={() => addExpense({ groupId: group.id })} data-testid="kharcha-group-add">
								<PlusIcon aria-hidden />
								<span className="max-sm:sr-only">{m.kharcha_create_expense()}</span>
							</Button>
						) : null}
					</div>
				</div>
				<nav aria-label={m.kharcha_group_tabs()} className="-mb-px flex gap-1">
					<TabLink groupId={group.id} tab="thread" current={search.tab}>
						{m.kharcha_group_tab_thread()}
					</TabLink>
					<TabLink groupId={group.id} tab="settings" current={search.tab}>
						{m.kharcha_group_tab_settings()}
					</TabLink>
				</nav>
			</header>

			<div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-8 sm:py-6">
				{group.left || group.archived ? (
					<p
						className="flex items-center gap-2 rounded-md border border-kh-hair bg-kh-page px-3 py-2 text-caption"
						data-testid="kharcha-group-notice"
					>
						<ArchiveIcon className="size-4 shrink-0 text-kh-muted" aria-hidden />
						{group.left ? m.kharcha_group_left_notice() : m.kharcha_group_archived_notice()}
					</p>
				) : null}
				{search.tab === "settings" ? (
					<Suspense fallback={null}>
						<GroupSettings group={group} userId={userId} />
					</Suspense>
				) : data.items.length === 0 ? (
					<KharchaEmpty
						kind="page"
						className="rounded-lg border border-kh-hair bg-kh-page"
						action={
							group.can.edit ? (
								<Button onClick={() => addExpense({ groupId: group.id })}>
									<PlusIcon aria-hidden />
									{m.kharcha_create_expense()}
								</Button>
							) : undefined
						}
					/>
				) : (
					<ThreadLines
						items={data.items}
						more={data.more}
						label={m.kharcha_thread_label({ name: group.name })}
						expenseLink={(expenseId) =>
							({ className, children }) => (
								<Link
									from="/app/kharcha/g/$groupId"
									to="."
									search={(prev) => ({ ...prev, expense: expenseId })}
									mask={{ to: "/app/kharcha/e/$expenseId", params: { expenseId }, unmaskOnReload: true }}
									className={className}
								>
									{children}
								</Link>
							)}
					/>
				)}
			</div>

			{search.expense ? (
				<Suspense fallback={null}>
					<ExpenseSheet userId={userId} expenseId={search.expense} onClose={close} />
				</Suspense>
			) : null}
		</main>
	);
}

/** "Trip · 3 members · 12 Oct – 16 Oct". */
function groupLine(group: GroupView): string {
	const dates =
		group.startOn && group.endOn
			? m.kharcha_group_dates({ from: formatDayMonth(group.startOn), to: formatDayMonth(group.endOn) })
			: group.startOn
				? formatDayMonth(group.startOn)
				: "";
	return [
		GROUP_KIND_LABELS[group.kind](),
		m.kharcha_group_members({ count: formatNumber(group.members.filter((member) => member.leftAt === null).length) }),
		dates,
	]
		.filter(Boolean)
		.join(" · ");
}

function TabLink({
	groupId,
	tab,
	current,
	children,
}: {
	groupId: string;
	tab: GroupTab;
	current: GroupTab;
	children: string;
}) {
	const active = tab === current;
	return (
		<Link
			to="/app/kharcha/g/$groupId"
			params={{ groupId }}
			search={{ tab }}
			aria-current={active ? "page" : undefined}
			className={cn(
				"kh-ease rounded-t-md border-b-2 px-3 py-2 font-medium text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				active ? "border-kh-act text-kh-ink" : "border-transparent text-kh-muted hover:text-kh-ink",
			)}
			data-testid={`kharcha-group-tab-${tab}`}
		>
			{children}
		</Link>
	);
}
