import { ListChecksIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { m } from "@/paraglide/messages";
import { tasklineColor } from "../colors";
import { activeFields, FIELD_TEXT_MAX, FIELD_URL_MAX, fieldValueText, isEmptyFieldValue } from "../fields";
import type { FieldValue, ProjectTasks, TaskField, TaskSummary } from "../types";

/**
 * A task's custom fields (Task 55), in the task's side panel: an editor per type, each
 * saving at once (text, numbers and links when the field is left), last write wins. A
 * required one that's empty says it's needed before the task is completed.
 */
export function TaskFieldEditors({
	task,
	project,
	editable,
	onChange,
}: {
	task: Pick<TaskSummary, "fields">;
	project: Pick<ProjectTasks, "fields" | "members">;
	editable: boolean;
	onChange: (fieldId: string, value: FieldValue | null) => void;
}) {
	const id = useId();
	const fields = activeFields(project.fields);
	if (fields.length === 0) return null;
	return (
		<div className="flex flex-col gap-4 border-t pt-4" data-testid="task-custom-fields">
			{fields.map((field) => {
				const value = task.fields[field.id];
				const control = `${id}-${field.id}`;
				const missing = field.required && isEmptyFieldValue(value);
				return (
					<div key={field.id} className="flex flex-col gap-1.5" data-testid="task-custom-field">
						<label htmlFor={control} className="text-caption font-medium text-muted-foreground">
							{field.name}
							{field.required ? (
								<>
									<span aria-hidden> *</span>
									<span className="sr-only"> ({m.taskline_field_required_badge()})</span>
								</>
							) : null}
						</label>
						<FieldEditor
							field={field}
							value={value}
							id={control}
							editable={editable}
							members={project.members}
							onChange={(next) => onChange(field.id, next)}
							describedBy={missing ? `${control}-missing` : undefined}
						/>
						{missing ? (
							<p id={`${control}-missing`} className="text-caption text-muted-foreground">
								{m.taskline_field_needed()}
							</p>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

function FieldEditor({
	field,
	value,
	id,
	editable,
	members,
	onChange,
	describedBy,
}: {
	field: TaskField;
	value: FieldValue | undefined;
	id: string;
	editable: boolean;
	members: ProjectTasks["members"];
	onChange: (value: FieldValue | null) => void;
	describedBy: string | undefined;
}) {
	const common = { id, disabled: !editable, "aria-describedby": describedBy, "data-testid": `field-${field.type}` };
	/** Text, numbers and links save when the field is left (or on Enter), once they changed. */
	const commit = (raw: string) => {
		const text = raw.trim();
		const next: FieldValue | null = text === "" ? null : field.type === "number" ? Number(text) : text;
		if (next !== null && field.type === "number" && !Number.isFinite(next)) return;
		if (JSON.stringify(next) !== JSON.stringify(value ?? null)) onChange(next);
	};
	const typed = {
		...common,
		key: `${field.id}:${JSON.stringify(value ?? null)}`,
		defaultValue: value === undefined ? "" : String(value),
		autoComplete: "off",
		onBlur: (event: React.FocusEvent<HTMLInputElement>) => commit(event.target.value),
		onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				event.preventDefault();
				commit(event.currentTarget.value);
			}
		},
	};
	switch (field.type) {
		case "text":
			return <Input {...typed} maxLength={FIELD_TEXT_MAX} />;
		case "url":
			return editable ? (
				<Input {...typed} type="url" inputMode="url" maxLength={FIELD_URL_MAX} placeholder="https://" />
			) : typeof value === "string" ? (
				<a href={value} target="_blank" rel="noopener noreferrer" className="truncate text-body underline">
					{value}
				</a>
			) : (
				<Input {...typed} />
			);
		case "number":
			return <Input {...typed} type="number" inputMode="decimal" step="any" />;
		case "date":
			return (
				<Input
					{...common}
					type="date"
					key={`${field.id}:${String(value ?? "")}`}
					defaultValue={typeof value === "string" ? value : ""}
					onChange={(event) => {
						const day = event.target.value;
						if (day === "" || /^\d{4}-\d{2}-\d{2}$/.test(day)) onChange(day || null);
					}}
				/>
			);
		case "select":
			return (
				<NativeSelect
					{...common}
					value={typeof value === "string" ? value : ""}
					onChange={(event) => onChange(event.target.value || null)}
				>
					<option value="">{m.taskline_field_no_value()}</option>
					{field.options.map((option) => (
						<option key={option.id} value={option.id}>
							{option.name}
						</option>
					))}
				</NativeSelect>
			);
		case "member":
			return (
				<NativeSelect
					{...common}
					value={typeof value === "string" ? value : ""}
					onChange={(event) => onChange(event.target.value || null)}
				>
					<option value="">{m.taskline_field_no_value()}</option>
					{members
						.filter((member) => !member.deactivated || member.id === value)
						.map((member) => (
							<option key={member.id} value={member.id}>
								{member.name}
							</option>
						))}
				</NativeSelect>
			);
		case "checkbox":
			return (
				<Checkbox
					{...common}
					checked={value === true}
					onCheckedChange={(checked) => onChange(checked === true ? true : null)}
				/>
			);
		case "multi_select": {
			const picked = Array.isArray(value) ? value : [];
			const toggle = (optionId: string, on: boolean) => {
				const next = on ? [...picked, optionId] : picked.filter((each) => each !== optionId);
				onChange(
					next.length > 0 ? field.options.map((option) => option.id).filter((each) => next.includes(each)) : null,
				);
			};
			return (
				<div className="flex flex-wrap items-center gap-1.5">
					{field.options
						.filter((option) => picked.includes(option.id))
						.map((option) => (
							<span key={option.id} className="inline-flex items-center gap-1 rounded-full border px-2 text-caption">
								<span
									aria-hidden
									className="size-2 rounded-full"
									style={{ backgroundColor: tasklineColor(option.color) }}
								/>
								{option.name}
							</span>
						))}
					{editable ? (
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button
									id={id}
									variant="ghost"
									size="sm"
									className="h-6 px-2"
									aria-describedby={describedBy}
									data-testid="field-multi_select"
								>
									<ListChecksIcon aria-hidden />
									{picked.length > 0 ? m.taskline_field_change() : m.taskline_field_choose()}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								{field.options.map((option) => (
									<DropdownMenuCheckboxItem
										key={option.id}
										checked={picked.includes(option.id)}
										onCheckedChange={(checked) => toggle(option.id, checked === true)}
										onSelect={(event) => event.preventDefault()}
									>
										{option.name}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					) : picked.length === 0 ? (
						<span id={id} className="text-body text-muted-foreground">
							{fieldValueText(field, value, members) || m.taskline_field_no_value()}
						</span>
					) : null}
				</div>
			);
		}
	}
}
