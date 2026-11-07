import { formOptions, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { addDays } from "@/lib/i18n/date-only";
import { formatNumber } from "@/lib/i18n/intl";
import { isoDate, optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { tasklineMutations } from "../queries";
import { SPRINT_GOAL_MAX, SPRINT_NAME_MAX } from "../schema";
import type { ProjectTasks, SprintCarry, SprintSummary } from "../types";
import { dayText, velocityText } from "./sprint-bits";

/**
 * The sprint dialogs (loaded when opened, 0168): planning one (a name, the dates, a
 * goal, with the recent velocity beside it) or editing it, and completing the active
 * one (where its unfinished tasks go). The server checks the dates again.
 */

const sprintFormSchema = z
	.object({
		name: required({ max: SPRINT_NAME_MAX }),
		goal: optionalText({ max: SPRINT_GOAL_MAX }),
		startOn: isoDate(),
		endOn: isoDate(),
	})
	.refine((value) => value.endOn >= value.startOn, {
		path: ["endOn"],
		error: () => m.taskline_sprint_error_dates(),
	});

/** A new sprint starts the day after the last open one ends (or today) and lasts two weeks. */
export function suggestedSprint(project: Pick<ProjectTasks, "sprints" | "sprintCount" | "today">) {
	const last = project.sprints
		.map((sprint) => sprint.endOn)
		.sort()
		.at(-1);
	const startOn = last && last >= project.today ? addDays(last, 1) : project.today;
	return {
		name: m.taskline_sprint_default_name({ number: formatNumber(project.sprintCount + 1) }),
		goal: "",
		startOn,
		endOn: addDays(startOn, 13),
	};
}

export function SprintFormDialog({
	userId,
	ws,
	project,
	sprint,
	onClose,
}: {
	userId: string;
	ws: string;
	project: ProjectTasks;
	/** The sprint to edit; none: plan a new one. */
	sprint: SprintSummary | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const create = useMutation(tasklineMutations.createSprint(queryClient, userId));
	const update = useMutation(tasklineMutations.updateSprint(queryClient, userId));
	const key = project.project.key;
	const active = sprint?.state === "active";
	const form = useAppForm({
		...formOptions({
			defaultValues: sprint
				? { name: sprint.name, goal: sprint.goal, startOn: sprint.startOn, endOn: sprint.endOn }
				: suggestedSprint(project),
			validators: formValidators(sprintFormSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				if (sprint) {
					await update.mutateAsync({
						ws,
						key,
						id: sprint.id,
						name: value.name,
						goal: value.goal,
						...(active ? {} : { startOn: value.startOn }),
						endOn: value.endOn,
					});
					toast.success(m.crud_toast_saved());
				} else {
					const created = await create.mutateAsync({ ws, key, ...value });
					toast.success(m.taskline_sprint_created({ sprint: created.name }));
				}
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={sprint ? m.taskline_sprint_edit_title({ sprint: sprint.name }) : m.taskline_sprint_new()}
				description={velocityText(project.velocity, project.project.settings.estimation)}
				submitLabel={sprint ? m.crud_save() : m.taskline_sprint_create()}
				onClose={onClose}
				data-testid="sprint-dialog"
			>
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={m.taskline_sprint_name()} maxLength={SPRINT_NAME_MAX} autoComplete="off" />
					)}
				</form.AppField>
				<div className="grid gap-4 sm:grid-cols-2">
					{/* An active sprint keeps the day it started. */}
					{active ? null : (
						<form.AppField name="startOn">
							{(field) => <field.DateField label={m.taskline_sprint_start()} />}
						</form.AppField>
					)}
					<form.AppField name="endOn">
						{(field) => (
							<field.DateField
								label={m.taskline_sprint_end()}
								description={
									active && sprint ? m.taskline_sprint_start_fixed({ date: dayText(sprint.startOn) }) : undefined
								}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="goal">
					{(field) => (
						<field.TextareaField
							label={m.taskline_sprint_goal()}
							description={m.taskline_sprint_goal_hint()}
							maxLength={SPRINT_GOAL_MAX}
							optional
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

const completeSchema = z.object({ carryTo: z.enum(["backlog", "next", "new"]), nextId: z.string() });

export function CompleteSprintDialog({
	userId,
	ws,
	project,
	sprint,
	unfinished,
	onClose,
}: {
	userId: string;
	ws: string;
	project: ProjectTasks;
	sprint: SprintSummary;
	/** Its tasks that aren't closed: what moves. */
	unfinished: number;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const complete = useMutation(tasklineMutations.completeSprint(queryClient, userId));
	const planned = project.sprints.filter((each) => each.state === "planned");
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				carryTo: (planned.length > 0 ? "next" : "backlog") as SprintCarry,
				nextId: planned[0]?.id ?? "",
			},
			validators: formValidators(completeSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await complete.mutateAsync({
					ws,
					key: project.project.key,
					id: sprint.id,
					carryTo: value.carryTo,
					...(value.carryTo === "next" ? { nextId: value.nextId } : {}),
				});
				toast.success(m.taskline_sprint_completed_toast({ sprint: sprint.name }));
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const carryTo = useStore(form.store, (state) => state.values.carryTo);
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_sprint_complete_title({ sprint: sprint.name })}
				description={
					unfinished === 0
						? m.taskline_sprint_complete_all_done()
						: m.taskline_sprint_complete_unfinished({ count: formatNumber(unfinished) })
				}
				submitLabel={m.taskline_sprint_complete()}
				onClose={onClose}
				data-testid="complete-sprint-dialog"
			>
				{unfinished > 0 ? (
					<>
						<form.AppField name="carryTo">
							{(field) => (
								<field.RadioGroupField
									label={m.taskline_sprint_carry_label()}
									options={[
										...(planned.length > 0 ? [{ value: "next", label: m.taskline_sprint_carry_next() }] : []),
										{ value: "new", label: m.taskline_sprint_carry_new() },
										{ value: "backlog", label: m.taskline_sprint_carry_backlog() },
									]}
								/>
							)}
						</form.AppField>
						{carryTo === "next" && planned.length > 1 ? (
							<form.AppField name="nextId">
								{(field) => (
									<field.SelectField
										label={m.taskline_sprint_carry_which()}
										options={planned.map((each) => ({ value: each.id, label: each.name }))}
									/>
								)}
							</form.AppField>
						) : null}
					</>
				) : null}
			</FormDialog>
		</form.AppForm>
	);
}
