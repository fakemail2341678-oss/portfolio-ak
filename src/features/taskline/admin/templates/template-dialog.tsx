import { formOptions } from "@tanstack/react-form";
import { useId, useState } from "react";
import { z } from "zod";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { FormSheet } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import {
	parseTemplateJson,
	TEMPLATE_DESCRIPTION_MAX,
	TEMPLATE_NAME_MAX,
	templateDefinition,
	templateFile,
} from "../../template-definition";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { tasklineAdminMutations } from "../queries";
import type { AdminTemplate } from "../schema";

/** What the dialog opens for. */
export type TemplateDialogStart =
	| { mode: "new" }
	| { mode: "import" }
	| { mode: "copy"; template: AdminTemplate }
	| { mode: "edit"; template: AdminTemplate };

/** The smallest template that's valid, to write from. */
const blank = () => ({
	statuses: [
		{
			id: "00000000-0000-4000-8000-000000000001",
			name: m.taskline_status_todo(),
			category: "unstarted",
			color: "blue",
		},
		{
			id: "00000000-0000-4000-8000-000000000002",
			name: m.taskline_status_done(),
			category: "completed",
			color: "green",
		},
	],
	settings: {},
});

/** A template's file is at most this big (two hundred tasks with long descriptions fit). */
const FILE_BYTES_MAX = 2_000_000;

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const formSchema = z.object({
	name: required({ max: TEMPLATE_NAME_MAX }),
	description: optionalText({ max: TEMPLATE_DESCRIPTION_MAX }),
	definition: z.string().superRefine((text, context) => {
		const parsed = parseTemplateJson(templateDefinition, text);
		if (!parsed.ok) context.addIssue({ code: "custom", message: parsed.message });
	}),
});

/**
 * A template's form (loaded on click): a name, a description and the definition as JSON,
 * checked as it's typed with the schema the server uses. "Import" reads a template's file
 * into the same form, so what's in it can be seen before it's saved.
 */
export default function TemplateDialog({ start, onClose }: { start: TemplateDialogStart; onClose: () => void }) {
	const create = useCrudMutation(tasklineAdminMutations.createTemplate(), { invalidate: ALL_TASKLINE_ADMIN });
	const update = useCrudMutation(tasklineAdminMutations.updateTemplate(), { invalidate: ALL_TASKLINE_ADMIN });
	const fileId = useId();
	const [fileError, setFileError] = useState<string | null>(null);
	const template = start.mode === "copy" || start.mode === "edit" ? start.template : null;
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name:
					start.mode === "copy"
						? m.taskline_template_copy_name({ name: template?.name ?? "" })
						: (template?.name ?? ""),
				description: template?.description ?? "",
				definition: pretty(template?.definition ?? blank()),
			},
			validators: formValidators(formSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			const parsed = parseTemplateJson(templateDefinition, value.definition);
			if (!parsed.ok) return;
			const input = { name: value.name.trim(), description: value.description.trim(), definition: parsed.value };
			try {
				if (start.mode === "edit") {
					await update.mutateAsync({ ...input, id: start.template.id, version: start.template.version });
				} else {
					await create.mutateAsync(input);
				}
				formApi.reset(value);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const readFile = async (file: File | undefined) => {
		if (!file) return;
		if (file.size > FILE_BYTES_MAX) {
			setFileError(m.taskline_template_error_invalid());
			return;
		}
		const parsed = parseTemplateJson(templateFile, await file.text());
		setFileError(parsed.ok ? null : parsed.message);
		if (!parsed.ok) return;
		form.setFieldValue("name", parsed.value.name);
		form.setFieldValue("description", parsed.value.description);
		form.setFieldValue("definition", pretty(parsed.value.definition));
	};
	return (
		<form.AppForm>
			<FormSheet
				title={
					start.mode === "edit"
						? m.taskline_template_edit_named({ name: start.template.name })
						: start.mode === "import"
							? m.taskline_template_import()
							: m.taskline_template_new()
				}
				description={m.taskline_template_dialog_description()}
				submitLabel={m.crud_save()}
				onClose={onClose}
				data-testid="template-dialog"
			>
				{start.mode === "import" ? (
					<div className="flex flex-col gap-2">
						<Label htmlFor={fileId}>{m.taskline_template_file()}</Label>
						<Input
							id={fileId}
							type="file"
							accept=".json,application/json"
							onChange={(event) => void readFile(event.target.files?.[0])}
							data-testid="template-file"
						/>
						{fileError ? (
							<p role="alert" className="text-caption text-destructive" data-testid="template-file-error">
								{fileError}
							</p>
						) : null}
					</div>
				) : null}
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={m.taskline_template_name()} maxLength={TEMPLATE_NAME_MAX} autoComplete="off" />
					)}
				</form.AppField>
				<form.AppField name="description">
					{(field) => (
						<field.TextareaField
							label={m.taskline_template_description()}
							maxLength={TEMPLATE_DESCRIPTION_MAX}
							optional
						/>
					)}
				</form.AppField>
				<form.AppField name="definition">
					{(field) => (
						<field.TextareaField
							label={m.taskline_template_definition()}
							description={m.taskline_template_definition_hint()}
							rows={18}
						/>
					)}
				</form.AppField>
			</FormSheet>
		</form.AppForm>
	);
}
