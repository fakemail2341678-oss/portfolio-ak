import { useDbClient, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation } from "@tanstack/react-router";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	CalendarCheckIcon,
	FlameIcon,
	Grid3x3Icon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
	ZapIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
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
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { addDays, type IsoDate, isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { appColor } from "../../colors";
import { TryAppButton } from "../../components/try-app-button";
import { checkinsCollection } from "../collections";
import { rateLabel, scheduleLabel, targetLabel } from "../format";
import { habitMutations, habitsOverviewQueryOptions } from "../queries";
import type { HabitsSearch } from "../search";
import { checkinId, HABITS_QUOTAS, type HabitCheckin, type HabitSummary, STRIP_DAYS } from "../types";
import { CheckinButton } from "./checkin-button";
import type { HabitDialogValues } from "./habit-dialog";

const HabitDialog = lazy(() => import("./habit-dialog"));

const route = getRouteApi("/_apps/apps/habits/");

/**
 * /apps/habits (decision 0193): the app's landing for a visitor, the user's habits once
 * they have a session (a guest's included). The landing is what search engines see.
 */
export function HabitsHome() {
	const { session } = route.useRouteContext();
	return session ? <HabitsList userId={session.user.id} /> : <HabitsLanding />;
}

function HabitsLanding() {
	const location = useLocation();
	const features = [
		{ icon: ZapIcon, title: m.habits_feature_checkin(), body: m.habits_feature_checkin_body() },
		{ icon: FlameIcon, title: m.habits_feature_streaks(), body: m.habits_feature_streaks_body() },
		{ icon: Grid3x3Icon, title: m.habits_feature_year(), body: m.habits_feature_year_body() },
	];
	return (
		<Page width="wide" data-testid="habits-landing">
			<div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,28rem)]">
				<div className="flex flex-col gap-6">
					<PageHeader size="display" title={m.habits_name()} description={m.habits_description()} />
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
				<HabitsPreview />
			</div>
			<section aria-labelledby="habits-features" className="flex flex-col gap-4">
				<h2 id="habits-features" className="text-heading">
					{m.habits_features_title()}
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

/** A still picture of two habits' weeks (decorative: the text beside it says what the app does). */
function HabitsPreview() {
	const habits = [
		{ name: m.habits_seed_read(), color: appColor("violet"), week: [1, 1, 1, 0, 1, 1, 1], streak: 9 },
		{ name: m.habits_seed_walk(), color: appColor("green"), week: [0, 1, 1, 1, 0, 1, 0], streak: 3 },
	];
	return (
		<div aria-hidden className="flex flex-col gap-3 rounded-xl border bg-surface-1 p-4 shadow-sm">
			{habits.map((habit) => (
				<div key={habit.name} className="flex flex-col gap-2 rounded-lg border bg-background p-3">
					<div className="flex items-center justify-between gap-2 text-caption">
						<span className="font-medium">{habit.name}</span>
						<span className="inline-flex items-center gap-1 text-muted-foreground">
							<FlameIcon className="size-3.5" />
							{formatNumber(habit.streak)}
						</span>
					</div>
					<div className="flex gap-1.5">
						{habit.week.map((done, index) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative week.
								key={index}
								className={cn("size-6 rounded-md border", done && "border-transparent")}
								style={done ? { backgroundColor: habit.color } : undefined}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

type Editing = { habit?: HabitSummary } | null;

function HabitsList({ userId }: { userId: string }) {
	const search = route.useSearch();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const {
		data: { habits, today },
	} = useSuspenseQuery(habitsOverviewQueryOptions(userId));
	const collection = useDbClient().collection(checkinsCollection(userId));
	const { data: checkins } = useLiveSuspenseQuery((q) => q.from({ checkin: collection }), [collection]);
	const create = useMutation(habitMutations.create(queryClient, userId));
	const update = useMutation(habitMutations.update(queryClient, userId));
	const remove = useMutation(habitMutations.delete(queryClient, userId));
	const [editing, setEditing] = useState<Editing>(null);
	const counts = new Map(checkins.map((checkin) => [checkin.id, checkin]));
	const shown = habits.filter((habit) => habit.archived === (search.view === "archived"));
	const strip = Array.from({ length: STRIP_DAYS }, (_, index) => addDays(today, index - (STRIP_DAYS - 1)));
	const full = habits.length >= HABITS_QUOTAS.habits;

	/** One more check-in on a day, back to none after the target: shows at once, rolled back if refused. */
	const tap = (habit: HabitSummary, day: IsoDate) => {
		const id = checkinId(habit.id, day);
		const current = counts.get(id);
		const next = (current?.count ?? 0) >= habit.target ? 0 : (current?.count ?? 0) + 1;
		const transaction = current
			? next === 0
				? collection.delete(id)
				: collection.update(id, (draft) => {
						draft.count = next;
					})
			: collection.insert({ id, habitId: habit.id, day, count: next } satisfies HabitCheckin);
		transaction.isPersisted.promise.catch((error: unknown) =>
			toast.error(m.habits_rolled_back(), { description: errorMessage(error) }),
		);
	};

	const setArchived = (habit: HabitSummary, archived: boolean) =>
		update.mutate(
			{ id: habit.id, archived },
			{
				onSuccess: () => toast.success(archived ? m.habits_toast_archived() : m.habits_toast_restored()),
				onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
			},
		);

	const removeHabit = async (habit: HabitSummary) => {
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: habit.name }),
			description: m.habits_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		remove.mutate(habit.id, {
			onSuccess: () => toast.success(m.crud_toast_deleted({ label: habit.name })),
			onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
		});
	};

	const newButton = (
		<Button onClick={() => setEditing({})} disabled={full} data-testid="habits-new">
			<PlusIcon aria-hidden />
			{m.habits_new()}
		</Button>
	);

	return (
		<Page width="default" data-testid="habits-list">
			<PageHeader
				title={m.habits_title()}
				description={m.habits_today({ date: formatDate(isoDateInstant(today), { dateStyle: "full" }) })}
				actions={newButton}
			/>
			<nav aria-label={m.habits_views()} className="flex items-center gap-2">
				<ViewLink view="active" current={search.view} label={m.habits_view_active()} />
				<ViewLink view="archived" current={search.view} label={m.habits_view_archived()} />
			</nav>
			{shown.length === 0 ? (
				<EmptyState
					icon={CalendarCheckIcon}
					title={search.view === "archived" ? m.habits_archive_empty() : m.habits_empty_title()}
					description={search.view === "archived" ? m.habits_archive_empty_body() : m.habits_empty_body()}
					primaryAction={search.view === "archived" ? undefined : newButton}
				/>
			) : (
				<ul className="flex flex-col gap-3">
					{shown.map((habit) => (
						<li
							key={habit.id}
							className="relative grid gap-4 rounded-lg border bg-surface-1 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
							data-testid="habits-row"
						>
							<div className="flex min-w-0 flex-col gap-1.5 pe-10 md:pe-0">
								<Link
									to="/apps/habits/$habitId"
									params={{ habitId: habit.id }}
									className="flex min-w-0 items-center gap-2 font-medium text-body outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
									data-testid="habits-open"
								>
									<span
										aria-hidden
										className="size-3 shrink-0 rounded-full"
										style={{ backgroundColor: appColor(habit.color) }}
									/>
									<span className="truncate">{habit.name}</span>
								</Link>
								<span className="text-caption text-muted-foreground">
									{scheduleLabel(habit.days)} · {targetLabel(habit.target)}
								</span>
								<span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
									<span className="inline-flex items-center gap-1" data-testid="habits-streak">
										<FlameIcon className="size-4 text-warning" aria-hidden />
										{m.habits_streak({ count: formatNumber(habit.streak) })}
									</span>
									<span className="text-muted-foreground">
										{m.habits_rate({ rate: rateLabel(habit.rate), days: formatNumber(30) })}
									</span>
								</span>
							</div>
							{habit.archived ? null : (
								<ul aria-label={m.habits_week_label({ name: habit.name })} className="flex gap-1.5">
									{strip.map((day) => (
										<li key={day}>
											<CheckinButton
												habit={habit}
												day={day}
												today={today}
												count={counts.get(checkinId(habit.id, day))?.count ?? 0}
												onTap={() => tap(habit, day)}
											/>
										</li>
									))}
								</ul>
							)}
							<DropdownMenu modal={false}>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="absolute end-2 top-2 md:static md:order-last"
										aria-label={m.habits_actions({ name: habit.name })}
										data-testid="habits-menu"
									>
										<MoreHorizontalIcon aria-hidden />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onSelect={() => setEditing({ habit })}>
										<PencilIcon aria-hidden />
										{m.habits_edit()}
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => setArchived(habit, !habit.archived)}>
										{habit.archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
										{habit.archived ? m.habits_restore() : m.habits_archive()}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive" onSelect={() => void removeHabit(habit)}>
										<Trash2Icon aria-hidden />
										{m.crud_delete()}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			)}
			<Suspense fallback={null}>
				{editing ? (
					<HabitDialog
						habit={editing.habit}
						onSubmit={async (values: HabitDialogValues) => {
							if (editing.habit) {
								await update.mutateAsync({ id: editing.habit.id, ...values });
								toast.success(m.crud_toast_saved());
							} else {
								await create.mutateAsync({ id: crypto.randomUUID(), ...values });
								toast.success(m.habits_toast_created({ name: values.name }));
							}
						}}
						onClose={() => setEditing(null)}
					/>
				) : null}
			</Suspense>
		</Page>
	);
}

function ViewLink({
	view,
	current,
	label,
}: {
	view: HabitsSearch["view"];
	current: HabitsSearch["view"];
	label: string;
}) {
	return (
		<Link
			to="/apps/habits"
			search={{ view }}
			aria-current={view === current ? "page" : undefined}
			className={cn(
				"rounded-md px-2.5 py-1 font-medium text-sm outline-none transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50",
				view === current ? "bg-surface-2 text-foreground" : "text-muted-foreground",
			)}
		>
			{label}
		</Link>
	);
}
