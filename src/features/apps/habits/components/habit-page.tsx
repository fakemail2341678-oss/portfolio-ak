import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	ArrowLeftIcon,
	CalendarCheckIcon,
	FlameIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PercentIcon,
	Trash2Icon,
	TrophyIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { StatCard } from "@/components/data-display/stat-card";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Page, PageHeader } from "@/components/page/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { rateLabel, scheduleLabel, targetLabel } from "../format";
import { habitMutations, habitQueryOptions, habitsKeys } from "../queries";
import { RATE_DAYS } from "../types";
import { HabitHeatmap } from "./habit-heatmap";

const HabitDialog = lazy(() => import("./habit-dialog"));

const route = getRouteApi("/_apps/apps/habits/$habitId");

/**
 * /apps/habits/$habitId (decision 0193): one habit's streaks, completion rate and year
 * of check-ins (the heatmap, rendered on the server), with edit, archive and delete.
 */
export function HabitPage() {
	const { habitId } = route.useParams();
	const { session } = route.useRouteContext();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const confirm = useConfirm();
	const {
		data: { habit, checkins, today },
	} = useSuspenseQuery(habitQueryOptions(userId, habitId));
	const update = useMutation(habitMutations.update(queryClient, userId));
	const remove = useMutation(habitMutations.delete(queryClient, userId));
	const [editing, setEditing] = useState(false);
	const doneThisYear = checkins.filter((each) => each.count >= habit.target).length;

	const setArchived = (archived: boolean) =>
		update.mutate(
			{ id: habit.id, archived },
			{
				onSuccess: () => toast.success(archived ? m.habits_toast_archived() : m.habits_toast_restored()),
				onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
			},
		);

	const removeHabit = async () => {
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: habit.name }),
			description: m.habits_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await remove.mutateAsync(habit.id);
			toast.success(m.crud_toast_deleted({ label: habit.name }));
			await navigate({ to: "/apps/habits" });
			queryClient.removeQueries({ queryKey: habitsKeys.habit(userId, habit.id) });
		} catch (error) {
			toast.error(m.common_toast_failed(), { description: errorMessage(error) });
		}
	};

	return (
		<Page width="default" data-testid="habit-page">
			<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
				<Link to="/apps/habits">
					<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
					{m.habits_back()}
				</Link>
			</Button>
			<PageHeader
				title={habit.name}
				description={`${scheduleLabel(habit.days)} · ${targetLabel(habit.target)}`}
				actions={
					<>
						<Button variant="outline" onClick={() => setEditing(true)}>
							<PencilIcon aria-hidden />
							{m.habits_edit()}
						</Button>
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon" aria-label={m.habits_actions({ name: habit.name })}>
									<MoreHorizontalIcon aria-hidden />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => setArchived(!habit.archived)}>
									{habit.archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
									{habit.archived ? m.habits_restore() : m.habits_archive()}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="destructive" onSelect={() => void removeHabit()}>
									<Trash2Icon aria-hidden />
									{m.crud_delete()}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				}
			/>
			{habit.archived ? (
				<Alert variant="info">
					<ArchiveIcon aria-hidden />
					<AlertDescription>{m.habits_archived_note()}</AlertDescription>
				</Alert>
			) : null}
			<section aria-labelledby="habit-stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<h2 id="habit-stats" className="sr-only">
					{m.dashboard_stats_title()}
				</h2>
				<StatCard label={m.habits_stat_streak()} value={habit.streak} icon={FlameIcon} />
				<StatCard label={m.habits_stat_best()} value={habit.best} icon={TrophyIcon} />
				<StatCard
					label={m.habits_stat_rate({ days: formatNumber(RATE_DAYS) })}
					value={habit.rate ?? 0}
					icon={PercentIcon}
					format={() => rateLabel(habit.rate)}
				/>
				<StatCard label={m.habits_stat_year()} value={doneThisYear} icon={CalendarCheckIcon} />
			</section>
			<section aria-labelledby="habit-year" className="flex flex-col gap-3 rounded-lg border p-4">
				<h2 id="habit-year" className="text-heading">
					{m.habits_year_title()}
				</h2>
				<HabitHeatmap
					today={today}
					checkins={checkins}
					days={habit.days}
					target={habit.target}
					color={habit.color}
					name={habit.name}
				/>
			</section>
			<Suspense fallback={null}>
				{editing ? (
					<HabitDialog
						habit={habit}
						onSubmit={async (values) => {
							await update.mutateAsync({ id: habit.id, ...values });
							toast.success(m.crud_toast_saved());
						}}
						onClose={() => setEditing(false)}
					/>
				) : null}
			</Suspense>
		</Page>
	);
}
