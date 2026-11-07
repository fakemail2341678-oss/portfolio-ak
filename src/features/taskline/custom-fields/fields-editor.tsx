import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	ArrowDownIcon,
	ArrowUpIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateKeyBetween } from "@/lib/fractional-index";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { tasklineColor } from "../colors";
import type { FieldDefinition } from "../fields";
import { FIELD_TYPE_LABELS } from "../labels";
import type { FieldChanges } from "../schema";
import type { TaskField } from "../types";

const FieldDialog = lazy(() => import("./field-dialog"));

/** What a scope's editor does with a change: the lead's app functions, or the admin's audited ones. */
export type FieldWrites = {
	create: (definition: FieldDefinition) => Promise<unknown>;
	update: (changes: FieldChanges) => Promise<unknown>;
	remove: (id: string) => Promise<unknown>;
	/** The writes say why they failed themselves (the admin's `useCrudMutation`): no second toast. */
	reportsErrors?: boolean;
};

/**
 * One scope's custom fields (Task 55): each with its type, whether it's required or
 * archived, a select's options and (the admin's) how many tasks have a value; edit,
 * up and down, archive or restore, delete (its values go with it), and "New field".
 */
export function FieldsEditor({
	fields,
	counts,
	writes,
	"data-testid": testId,
}: {
	fields: ReadonlyArray<TaskField>;
	/** How many tasks have a value of each field, when known (the admin's page). */
	counts?: ReadonlyMap<string, number>;
	writes: FieldWrites;
	"data-testid"?: string;
}) {
	const confirm = useConfirm();
	const [editing, setEditing] = useState<TaskField | "new" | null>(null);
	const fail = (error: unknown) => {
		if (!writes.reportsErrors) toast.error(errorMessage(error));
	};
	const run = (write: Promise<unknown>) => write.catch(fail);

	const move = (index: number, by: -1 | 1) => {
		const field = fields[index];
		const target = index + by;
		if (!field || target < 0 || target >= fields.length) return;
		const [before, after] = by === -1 ? [fields[target - 1], fields[target]] : [fields[target], fields[target + 1]];
		void run(
			writes.update({
				id: field.id,
				position: generateKeyBetween(before?.position ?? null, after?.position ?? null),
			}),
		);
	};

	const remove = async (field: TaskField) => {
		const used = counts?.get(field.id);
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: field.name }),
			description:
				used === undefined
					? m.taskline_field_delete_body()
					: m.taskline_field_delete_body_count({ count: formatNumber(used) }),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (confirmed) await run(writes.remove(field.id));
	};

	return (
		<div className="flex flex-col gap-3" data-testid={testId}>
			{fields.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.taskline_fields_empty()}</p>
			) : (
				<ul className="flex flex-col divide-y rounded-md border">
					{fields.map((field, index) => (
						<li
							key={field.id}
							className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2"
							data-testid="field-row"
						>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<span className="flex flex-wrap items-center gap-2">
									<span className="font-medium">{field.name}</span>
									<Badge variant="outline">{FIELD_TYPE_LABELS[field.type]()}</Badge>
									{field.required ? <Badge variant="secondary">{m.taskline_field_required_badge()}</Badge> : null}
									{field.archived ? <Badge variant="secondary">{m.taskline_field_archived()}</Badge> : null}
								</span>
								{field.options.length > 0 ? (
									<span className="flex flex-wrap gap-1.5 text-caption text-muted-foreground">
										{field.options.map((option) => (
											<span key={option.id} className="inline-flex items-center gap-1">
												<span
													aria-hidden
													className="size-2 rounded-full"
													style={{ backgroundColor: tasklineColor(option.color) }}
												/>
												{option.name}
											</span>
										))}
									</span>
								) : null}
								{counts ? (
									<span className="text-caption text-muted-foreground">
										{m.taskline_field_tasks({ count: formatNumber(counts.get(field.id) ?? 0) })}
									</span>
								) : null}
							</div>
							<div className="flex flex-wrap items-center gap-1">
								<Button variant="ghost" size="icon" onClick={() => setEditing(field)} data-testid="field-edit">
									<PencilIcon aria-hidden />
									<span className="sr-only">{m.taskline_field_edit_title({ name: field.name })}</span>
								</Button>
								<Button variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)}>
									<ArrowUpIcon aria-hidden />
									<span className="sr-only">{m.taskline_field_up({ name: field.name })}</span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									disabled={index === fields.length - 1}
									onClick={() => move(index, 1)}
								>
									<ArrowDownIcon aria-hidden />
									<span className="sr-only">{m.taskline_field_down({ name: field.name })}</span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => void run(writes.update({ id: field.id, archived: !field.archived }))}
									data-testid="field-archive"
								>
									{field.archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
									<span className="sr-only">
										{field.archived
											? m.taskline_field_restore({ name: field.name })
											: m.taskline_field_archive({ name: field.name })}
									</span>
								</Button>
								<Button variant="ghost" size="icon" onClick={() => void remove(field)}>
									<Trash2Icon aria-hidden />
									<span className="sr-only">{m.crud_delete_title({ label: field.name })}</span>
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
			<div>
				<Button variant="outline" onClick={() => setEditing("new")} data-testid="field-new">
					<PlusIcon aria-hidden />
					{m.taskline_field_new()}
				</Button>
			</div>
			<Suspense fallback={null}>
				{editing ? (
					<FieldDialog
						field={editing === "new" ? null : editing}
						onClose={() => setEditing(null)}
						onSave={async (definition) => {
							if (editing === "new") {
								await writes.create(definition);
								toast.success(m.taskline_field_created({ name: definition.name }));
								return;
							}
							await writes.update({
								id: editing.id,
								name: definition.name,
								required: definition.required,
								...("options" in definition ? { options: definition.options } : {}),
							});
							toast.success(m.crud_toast_saved());
						}}
					/>
				) : null}
			</Suspense>
		</div>
	);
}
