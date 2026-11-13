import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PauseIcon, PencilIcon, PlayIcon, SkipForwardIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { deleteKharchaRecurring, pauseKharchaRecurring, skipKharchaRecurring } from "@/functions/kharcha/recurring";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { cadenceLabel, PROBLEM_LABELS, recurringName } from "../budgets/labels";
import { CategoryIcon } from "../kit/category-icon";
import { KharchaEmpty } from "../kit/empty";
import { Money } from "../kit/money";
import { kharchaLinks } from "../links";
import { kharchaMeQueryOptions, kharchaMutations, kharchaRecurringQueryOptions } from "../queries";
import { useKharchaUserId } from "../shell/actions";
import type { RecurringView } from "../types";

const RepeatDialog = lazy(() => import("./repeat-dialog"));

const day = (value: string) => formatDate(isoDateInstant(value), { dateStyle: "medium", timeZone: "UTC" });

/** When it is made next, or why it isn't. */
export function recurringStatus(recurring: RecurringView): string {
	if (recurring.ended) return m.kharcha_recurring_ended();
	if (recurring.problem) return m.kharcha_recurring_stopped({ why: PROBLEM_LABELS[recurring.problem]() });
	if (recurring.paused) return m.kharcha_recurring_paused();
	return m.kharcha_recurring_next({ day: day(recurring.nextOn) });
}

/**
 * Settings → Recurring (Task 94): the caller's recurring expenses, next due first: what each
 * makes, how often, when next (or why not), with Skip the next one, Pause or Resume, Edit
 * and Delete. They start from "Repeat…" on an expense; the daily job makes them.
 */
export function RecurringList() {
	const userId = useKharchaUserId();
	const { data: recurring } = useSuspenseQuery(kharchaRecurringQueryOptions(userId));
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [editing, setEditing] = useState<RecurringView | null>(null);
	const change = useMutation({
		...kharchaMutations.recurring(queryClient, userId),
		onError: (error) => toast.error(errorMessage(error)),
	});
	const remove = async (each: RecurringView) => {
		const ok = await confirm({
			title: m.kharcha_recurring_delete_title({ name: recurringName(each) }),
			description: m.kharcha_recurring_delete_body(),
			confirmLabel: m.kharcha_settings_delete(),
			destructive: true,
		});
		if (ok) change.mutate(() => deleteKharchaRecurring({ data: { recurringId: each.id } }));
	};

	return (
		<section className="flex flex-col gap-3" data-testid="kharcha-recurring">
			<p className="text-kh-muted text-sm">{m.kharcha_recurring_help()}</p>
			{recurring.length === 0 ? (
				<KharchaEmpty
					kind="recurring"
					className="rounded-lg border border-kh-hair bg-kh-page"
					action={
						<Button asChild variant="outline">
							<Link {...kharchaLinks.spend()}>{m.kharcha_nav_spend()}</Link>
						</Button>
					}
				/>
			) : (
				<ul className="divide-y divide-kh-rule rounded-lg border border-kh-hair bg-kh-page">
					{recurring.map((each) => {
						const name = recurringName(each);
						const stopped = each.paused || each.ended;
						return (
							<li
								key={each.id}
								className="flex flex-wrap items-center gap-3 px-4 py-3"
								data-testid="kharcha-recurring-item"
								data-paused={each.paused ? "true" : undefined}
							>
								<CategoryIcon
									icon={each.category?.icon ?? null}
									{...(each.category ? { color: each.category.color } : {})}
								/>
								<div className="flex min-w-0 flex-1 flex-col gap-0.5">
									<p className="flex flex-wrap items-baseline gap-x-2">
										<span className="truncate font-medium text-kh-ink">{name}</span>
										<Money amountMinor={each.amountMinor} currency={each.currency} size="sm" />
									</p>
									<p className="text-caption text-kh-muted">
										{cadenceLabel(each.unit, each.every)}
										{each.group
											? ` · ${each.group.name}`
											: each.people.length > 0
												? ` · ${each.people.map((person) => person.name).join(", ")}`
												: ""}
										{each.endsOn ? ` · ${m.kharcha_recurring_until({ day: day(each.endsOn) })}` : ""}
									</p>
									<p className={stopped || each.problem ? "text-caption text-kh-owe" : "text-caption text-kh-ink"}>
										{recurringStatus(each)}
										{each.made > 0 ? ` · ${m.kharcha_recurring_made({ count: formatNumber(each.made) })}` : ""}
									</p>
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-1">
									{!stopped ? (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => change.mutate(() => skipKharchaRecurring({ data: { recurringId: each.id } }))}
											disabled={change.isPending}
											data-testid="kharcha-recurring-skip"
										>
											<SkipForwardIcon aria-hidden />
											{m.kharcha_recurring_skip()}
											<span className="sr-only">{` ${name}`}</span>
										</Button>
									) : null}
									{!each.ended ? (
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												change.mutate(() =>
													pauseKharchaRecurring({ data: { recurringId: each.id, paused: !each.paused } }),
												)
											}
											disabled={change.isPending}
											data-testid="kharcha-recurring-pause"
										>
											{each.paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
											{each.paused ? m.kharcha_recurring_resume() : m.kharcha_recurring_pause()}
											<span className="sr-only">{` ${name}`}</span>
										</Button>
									) : null}
									<Button variant="ghost" size="icon" onClick={() => setEditing(each)}>
										<PencilIcon aria-hidden />
										<span className="sr-only">{m.kharcha_recurring_edit_named({ name })}</span>
									</Button>
									<Button variant="ghost" size="icon" onClick={() => void remove(each)} disabled={change.isPending}>
										<Trash2Icon aria-hidden />
										<span className="sr-only">{m.kharcha_recurring_delete_named({ name })}</span>
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}
			{editing ? (
				<Suspense fallback={null}>
					<RepeatDialog
						from={{ recurring: editing }}
						today={me.today}
						onSaved={(next) => {
							queryClient.setQueryData(kharchaRecurringQueryOptions(userId).queryKey, next);
						}}
						onClose={() => setEditing(null)}
					/>
				</Suspense>
			) : null}
		</section>
	);
}
