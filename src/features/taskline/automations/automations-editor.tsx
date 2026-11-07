import { PencilIcon, PlusIcon, Trash2Icon, ZapIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/data-display/relative-time";
import { StatusBadge, type StatusTone } from "@/components/data-display/status-badge";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { m } from "@/paraglide/messages";
import type { AutomationDefinition } from "../automation-rules";
import type { Automation, AutomationCondition, AutomationOutcome, AutomationPreview } from "../types";
import { type AutomationOptions, automationSummary, OUTCOME_LABELS } from "./describe";

const AutomationDialog = lazy(() => import("./automation-dialog"));

/** The builder's preview: a query key (the conditions are added to it) and the call. */
export type AutomationPreviewSource = {
	queryKey: readonly unknown[];
	run: (conditions: AutomationCondition[]) => Promise<AutomationPreview>;
};

/** What a scope's editor does with a change: the lead's app functions, or the admin's audited ones. */
export type AutomationWrites = {
	create: (definition: AutomationDefinition) => Promise<unknown>;
	update: (input: { id: string; version: number; automation: AutomationDefinition }) => Promise<unknown>;
	toggle: (input: { id: string; enabled: boolean }) => Promise<unknown>;
	remove: (id: string) => Promise<unknown>;
	preview: AutomationPreviewSource;
	/** The writes say why they failed themselves (the admin's `useCrudMutation`): no second toast. */
	reportsErrors?: boolean;
};

/** A run's outcome as a badge's tone. */
export const OUTCOME_TONES: Record<AutomationOutcome, StatusTone> = {
	ok: "success",
	skipped: "neutral",
	failed: "danger",
};

/** A rule as it reads: when, if, then. */
export function AutomationSentence({ automation, options }: { automation: Automation; options: AutomationOptions }) {
	const { when, conditions, actions } = automationSummary(automation, options);
	return (
		<span className="flex flex-col gap-0.5 text-body text-muted-foreground">
			<span>{when}</span>
			{conditions.length > 0 ? (
				<span>{m.taskline_automation_summary_if({ conditions: conditions.join(m.taskline_automation_and()) })}</span>
			) : null}
			<span>{m.taskline_automation_summary_then({ actions: actions.join(", ") })}</span>
		</span>
	);
}

/**
 * One scope's automations (Task 56): each rule as a sentence, on or off at once, its
 * latest run, edit and delete, and "New automation" (the builder, loaded when opened).
 */
export function AutomationsEditor({
	automations,
	options,
	writes,
	now,
	"data-testid": testId,
}: {
	automations: ReadonlyArray<Automation>;
	options: AutomationOptions;
	writes: AutomationWrites;
	/** The page's clock, for "ran 5 minutes ago". */
	now: number;
	"data-testid"?: string;
}) {
	const confirm = useConfirm();
	const [editing, setEditing] = useState<Automation | "new" | null>(null);
	const fail = (error: unknown) => {
		if (!writes.reportsErrors) toast.error(errorMessage(error));
	};

	const remove = async (automation: Automation) => {
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: automation.name }),
			description: m.taskline_automation_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (confirmed) await writes.remove(automation.id).catch(fail);
	};

	return (
		<div className="flex flex-col gap-3" data-testid={testId}>
			{automations.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.taskline_automations_empty()}</p>
			) : (
				<ul className="flex flex-col divide-y rounded-md border">
					{automations.map((automation) => (
						<li
							key={automation.id}
							className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-3"
							data-testid="automation-row"
						>
							<ZapIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<span className="flex flex-wrap items-center gap-2">
									<span className="font-medium">{automation.name}</span>
									{automation.enabled ? null : <Badge variant="secondary">{m.taskline_automation_off()}</Badge>}
								</span>
								<AutomationSentence automation={automation} options={options} />
								{automation.lastRun ? (
									<span className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
										<StatusBadge tone={OUTCOME_TONES[automation.lastRun.outcome]}>
											{OUTCOME_LABELS[automation.lastRun.outcome]()}
										</StatusBadge>
										<RelativeTime value={automation.lastRun.at} now={now} />
									</span>
								) : (
									<span className="text-caption text-muted-foreground">{m.taskline_automation_never_ran()}</span>
								)}
							</div>
							<div className="flex items-center gap-1">
								<Switch
									checked={automation.enabled}
									onCheckedChange={(enabled) => void writes.toggle({ id: automation.id, enabled }).catch(fail)}
									aria-label={m.taskline_automation_toggle({ name: automation.name })}
									data-testid="automation-toggle"
								/>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setEditing(automation)}
									data-testid="automation-edit"
								>
									<PencilIcon aria-hidden />
									<span className="sr-only">{m.taskline_automation_edit_title({ name: automation.name })}</span>
								</Button>
								<Button variant="ghost" size="icon" onClick={() => void remove(automation)}>
									<Trash2Icon aria-hidden />
									<span className="sr-only">{m.crud_delete_title({ label: automation.name })}</span>
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
			<div>
				<Button variant="outline" onClick={() => setEditing("new")} data-testid="automation-new">
					<PlusIcon aria-hidden />
					{m.taskline_automation_new()}
				</Button>
			</div>
			<Suspense fallback={null}>
				{editing ? (
					<AutomationDialog
						automation={editing === "new" ? null : editing}
						options={options}
						preview={writes.preview}
						onClose={() => setEditing(null)}
						onSave={async (definition, version) => {
							if (editing === "new") {
								await writes.create(definition);
								toast.success(m.taskline_automation_created({ name: definition.name }));
								return;
							}
							await writes.update({ id: editing.id, version: version ?? editing.version, automation: definition });
							toast.success(m.crud_toast_saved());
						}}
					/>
				) : null}
			</Suspense>
		</div>
	);
}
