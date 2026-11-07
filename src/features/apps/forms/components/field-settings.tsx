import { CopyIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { moveItem, SortableList } from "@/components/forms/fields/sortable-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/errors";
import { formatNumber, parseLocaleNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import {
	FIELD_HELP_MAX,
	FIELD_LABEL_MAX,
	type FieldOption,
	type FormField,
	LONG_TEXT_MAX,
	newOptionId,
	OPTION_LABEL_MAX,
	OPTIONS_MAX,
	OPTIONS_MIN,
	RATING_LABEL_MAX,
	SHORT_TEXT_MAX,
} from "../fields";
import { FIELD_TYPE_INFO } from "../labels";
import { FORM_DESCRIPTION_MAX, FORM_TITLE_MAX } from "../schema";

/**
 * The builder's settings panel (decision 0195): the form's title and description when
 * no question is selected, otherwise the selected question's label, help, whether it
 * is required and its own options. Every change goes straight into the draft (the
 * preview shows it); the save checks the whole definition, and its problems come
 * back here under their settings (`errors`, keyed like the save's input:
 * "fields.2.label").
 */

/** A labelled setting with its problem under it (wired with aria-describedby). */
function Setting({
	label,
	error,
	hint,
	children,
}: {
	label: string;
	error?: string | undefined;
	hint?: string | undefined;
	children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
	const id = useId();
	const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			{children({
				id,
				...(error ? { "aria-invalid": true as const } : {}),
				...(describedBy ? { "aria-describedby": describedBy } : {}),
			})}
			{hint ? (
				<p id={`${id}-hint`} className="text-caption text-muted-foreground">
					{hint}
				</p>
			) : null}
			{error ? (
				<p id={`${id}-error`} className="text-destructive text-sm">
					{error}
				</p>
			) : null}
		</div>
	);
}

/** A number setting that may be empty (null): what's typed is kept while it isn't a number yet. */
function NumberSetting({
	label,
	value,
	onChange,
	error,
	hint,
	integer = false,
}: {
	label: string;
	value: number | null;
	onChange: (value: number | null) => void;
	error?: string | undefined;
	hint?: string | undefined;
	integer?: boolean;
}) {
	const [draft, setDraft] = useState(value === null ? "" : String(value));
	const parsed = draft.trim() === "" ? null : parseLocaleNumber(draft);
	const typo =
		parsed !== null && (parsed === undefined || !Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)));
	return (
		<Setting label={label} hint={hint} error={typo ? m.validation_number() : error}>
			{(props) => (
				<Input
					{...props}
					inputMode={integer ? "numeric" : "decimal"}
					autoComplete="off"
					value={draft}
					onChange={(event) => {
						const text = event.target.value;
						setDraft(text);
						const next = text.trim() === "" ? null : parseLocaleNumber(text);
						if (next === null) onChange(null);
						else if (next !== undefined && Number.isFinite(next) && (!integer || Number.isInteger(next)))
							onChange(next);
					}}
				/>
			)}
		</Setting>
	);
}

function SwitchSetting({
	label,
	checked,
	onChange,
	disabled,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	const id = useId();
	return (
		<div className="flex items-center justify-between gap-3">
			<Label htmlFor={id}>{label}</Label>
			<Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
		</div>
	);
}

/** The form's own settings (nothing selected). */
export function FormSettings({
	title,
	description,
	errors,
	onChange,
}: {
	title: string;
	description: string;
	errors: FieldErrors;
	onChange: (patch: { title?: string; description?: string }) => void;
}) {
	return (
		<div className="flex flex-col gap-4" data-testid="forms-settings">
			<h2 className="font-medium text-body">{m.forms_settings_form()}</h2>
			<Setting label={m.forms_field_title()} error={errors.title?.[0]}>
				{(props) => (
					<Input
						{...props}
						value={title}
						maxLength={FORM_TITLE_MAX}
						onChange={(event) => onChange({ title: event.target.value })}
					/>
				)}
			</Setting>
			<Setting
				label={m.forms_field_description()}
				hint={m.forms_field_description_hint()}
				error={errors.description?.[0]}
			>
				{(props) => (
					<Textarea
						{...props}
						rows={4}
						value={description}
						maxLength={FORM_DESCRIPTION_MAX}
						onChange={(event) => onChange({ description: event.target.value })}
					/>
				)}
			</Setting>
			<p className="text-muted-foreground text-sm">{m.forms_settings_hint()}</p>
		</div>
	);
}

/** The selected question's settings. `errors` are this field's, keyed from the field ("label", "options.1.label"). */
export function FieldSettings({
	field,
	errors,
	onChange,
	onDuplicate,
	onRemove,
	onClose,
}: {
	field: FormField;
	errors: FieldErrors;
	onChange: (field: FormField) => void;
	onDuplicate: () => void;
	onRemove: () => void;
	onClose: () => void;
}) {
	const info = FIELD_TYPE_INFO[field.type];
	const error = (key: string) => errors[key]?.[0];
	return (
		<div className="flex flex-col gap-4" data-testid="forms-field-settings">
			<div className="flex items-center gap-2">
				<info.icon className="size-4 text-muted-foreground" aria-hidden />
				<h2 className="font-medium text-body">{m.forms_settings_field({ type: info.label() })}</h2>
				<Button
					variant="ghost"
					size="icon-sm"
					className="ms-auto"
					onClick={onClose}
					aria-label={m.forms_settings_close()}
				>
					<XIcon aria-hidden />
				</Button>
			</div>
			<Setting
				label={field.type === "consent" ? m.forms_field_statement() : m.forms_field_question()}
				error={error("label")}
			>
				{(props) => (
					<Textarea
						{...props}
						rows={2}
						value={field.label}
						maxLength={FIELD_LABEL_MAX}
						onChange={(event) => onChange({ ...field, label: event.target.value })}
						data-testid="forms-setting-label"
					/>
				)}
			</Setting>
			<Setting label={m.forms_field_help()} hint={m.forms_field_help_hint()} error={error("help")}>
				{(props) => (
					<Input
						{...props}
						value={field.help}
						maxLength={FIELD_HELP_MAX}
						onChange={(event) => onChange({ ...field, help: event.target.value })}
					/>
				)}
			</Setting>
			<SwitchSetting
				label={field.type === "consent" ? m.forms_field_must_agree() : m.forms_field_required()}
				checked={field.required}
				onChange={(required) => onChange({ ...field, required })}
			/>
			<TypeSettings field={field} error={error} onChange={onChange} />
			<div className="flex flex-wrap gap-2 border-t pt-4">
				<Button variant="outline" size="sm" onClick={onDuplicate}>
					<CopyIcon aria-hidden />
					{m.forms_duplicate()}
				</Button>
				<Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
					<Trash2Icon aria-hidden />
					{m.forms_remove()}
				</Button>
			</div>
		</div>
	);
}

function TypeSettings({
	field,
	error,
	onChange,
}: {
	field: FormField;
	error: (key: string) => string | undefined;
	onChange: (field: FormField) => void;
}) {
	switch (field.type) {
		case "short_text":
		case "long_text": {
			const max = field.type === "short_text" ? SHORT_TEXT_MAX : LONG_TEXT_MAX;
			return (
				<NumberSetting
					label={m.forms_field_max_length()}
					hint={m.forms_field_max_length_hint({ max: formatNumber(max) })}
					value={field.maxLength}
					integer
					error={error("maxLength")}
					onChange={(value) => onChange({ ...field, maxLength: value ?? max })}
				/>
			);
		}
		case "number":
			return (
				<>
					<div className="grid grid-cols-2 gap-3">
						<NumberSetting
							label={m.forms_field_min()}
							value={field.min}
							error={error("min")}
							onChange={(min) => onChange({ ...field, min })}
						/>
						<NumberSetting
							label={m.forms_field_max()}
							value={field.max}
							error={error("max")}
							onChange={(max) => onChange({ ...field, max })}
						/>
					</div>
					<SwitchSetting
						label={m.forms_field_integer()}
						checked={field.integer}
						onChange={(integer) => onChange({ ...field, integer })}
					/>
				</>
			);
		case "single_select":
			return (
				<>
					<Setting label={m.forms_field_display()}>
						{(props) => (
							<NativeSelect
								{...props}
								value={field.display}
								onChange={(event) =>
									onChange({ ...field, display: event.target.value === "dropdown" ? "dropdown" : "radio" })
								}
							>
								<option value="radio">{m.forms_display_radio()}</option>
								<option value="dropdown">{m.forms_display_dropdown()}</option>
							</NativeSelect>
						)}
					</Setting>
					<OptionsEditor
						options={field.options}
						error={error}
						onChange={(options) => onChange({ ...field, options })}
					/>
				</>
			);
		case "multi_select":
			return (
				<>
					<OptionsEditor
						options={field.options}
						error={error}
						onChange={(options) => onChange({ ...field, options })}
					/>
					<NumberSetting
						label={m.forms_field_max_choices()}
						hint={m.forms_field_max_choices_hint()}
						value={field.maxChoices}
						integer
						error={error("maxChoices")}
						onChange={(maxChoices) => onChange({ ...field, maxChoices })}
					/>
				</>
			);
		case "rating":
			return (
				<div className="grid grid-cols-2 gap-3">
					<Setting label={m.forms_field_low_label()} error={error("lowLabel")}>
						{(props) => (
							<Input
								{...props}
								value={field.lowLabel}
								maxLength={RATING_LABEL_MAX}
								placeholder={m.forms_low_placeholder()}
								onChange={(event) => onChange({ ...field, lowLabel: event.target.value })}
							/>
						)}
					</Setting>
					<Setting label={m.forms_field_high_label()} error={error("highLabel")}>
						{(props) => (
							<Input
								{...props}
								value={field.highLabel}
								maxLength={RATING_LABEL_MAX}
								placeholder={m.forms_high_placeholder()}
								onChange={(event) => onChange({ ...field, highLabel: event.target.value })}
							/>
						)}
					</Setting>
				</div>
			);
		case "date":
			return (
				<div className="grid grid-cols-2 gap-3">
					<Setting label={m.forms_field_earliest()} error={error("min")}>
						{(props) => (
							<Input
								{...props}
								type="date"
								value={field.min ?? ""}
								onChange={(event) => onChange({ ...field, min: event.target.value || null })}
							/>
						)}
					</Setting>
					<Setting label={m.forms_field_latest()} error={error("max")}>
						{(props) => (
							<Input
								{...props}
								type="date"
								value={field.max ?? ""}
								onChange={(event) => onChange({ ...field, max: event.target.value || null })}
							/>
						)}
					</Setting>
				</div>
			);
		default:
			return null;
	}
}

/** A choice question's options: renamed in place, reordered (drag or keyboard), added and removed. */
function OptionsEditor({
	options,
	error,
	onChange,
}: {
	options: ReadonlyArray<FieldOption>;
	error: (key: string) => string | undefined;
	onChange: (options: FieldOption[]) => void;
}) {
	const legend = useId();
	const listError = error("options");
	return (
		<fieldset className="flex flex-col gap-2" aria-describedby={listError ? `${legend}-error` : undefined}>
			<legend className="mb-1.5 font-medium text-sm">{m.forms_field_options()}</legend>
			<SortableList
				items={options}
				getId={(option) => option.id}
				getLabel={(option, index) => option.label || m.forms_default_option({ number: formatNumber(index + 1) })}
				onMove={(from, to) => onChange(moveItem(options, from, to))}
				renderItem={(option, index, handle) => {
					const label = m.forms_option_label({ number: formatNumber(index + 1) });
					const problem = error(`options.${index}.label`);
					return (
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-1">
								{handle}
								<Input
									aria-label={label}
									value={option.label}
									maxLength={OPTION_LABEL_MAX}
									aria-invalid={problem ? true : undefined}
									onChange={(event) =>
										onChange(
											options.map((each) => (each.id === option.id ? { ...each, label: event.target.value } : each)),
										)
									}
									data-testid="forms-option"
								/>
								<Button
									variant="ghost"
									size="icon-sm"
									disabled={options.length <= OPTIONS_MIN}
									aria-label={m.forms_option_remove({ item: option.label || label })}
									onClick={() => onChange(options.filter((each) => each.id !== option.id))}
								>
									<XIcon aria-hidden />
								</Button>
							</div>
							{problem ? <p className="ms-10 text-destructive text-sm">{problem}</p> : null}
						</div>
					);
				}}
			/>
			<Button
				variant="outline"
				size="sm"
				className="self-start"
				disabled={options.length >= OPTIONS_MAX}
				onClick={() =>
					onChange([
						...options,
						{ id: newOptionId(), label: m.forms_default_option({ number: formatNumber(options.length + 1) }) },
					])
				}
			>
				<PlusIcon aria-hidden />
				{m.forms_option_add()}
			</Button>
			{listError ? (
				<p id={`${legend}-error`} className="text-destructive text-sm">
					{listError}
				</p>
			) : null}
		</fieldset>
	);
}
