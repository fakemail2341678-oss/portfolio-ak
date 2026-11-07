import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldLabelText, FieldMessages, FieldShell, useFieldA11y } from "../field-shell";

export type FieldOption = {
	value: string;
	label: string;
	description?: string;
	/** Shown but not changeable (e.g. a permission the user may not grant). */
	disabled?: boolean;
};

const optionId = (fieldId: string, value: string) => `${fieldId}-${value.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

// ---------------------------------------------------------------------------
// Select (short lists)
// ---------------------------------------------------------------------------

export type SelectFieldProps = FieldBaseProps & { options: ReadonlyArray<FieldOption>; placeholder?: string };

export function SelectField({ label, description, optional, options, placeholder }: SelectFieldProps) {
	const field = useFieldContext<string>();
	return (
		<FieldShell label={label} description={description} optional={optional}>
			{(control) => (
				<Select
					name={control.name}
					value={field.state.value ?? ""}
					onValueChange={(value) => {
						field.handleChange(value);
						field.handleBlur();
					}}
				>
					<SelectTrigger
						id={control.id}
						aria-invalid={control["aria-invalid"]}
						aria-describedby={control["aria-describedby"]}
						onBlur={control.onBlur}
						className="w-full"
					>
						<SelectValue placeholder={placeholder ?? m.select_placeholder()} />
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</FieldShell>
	);
}

// ---------------------------------------------------------------------------
// Combobox / multi-select (searchable, long lists)
// ---------------------------------------------------------------------------

type SearchableProps = FieldBaseProps & {
	options: ReadonlyArray<FieldOption>;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyText?: string;
};

export function OptionList({
	listId,
	options,
	isSelected,
	onSelect,
	searchPlaceholder,
	emptyText,
}: {
	listId: string;
	options: ReadonlyArray<FieldOption>;
	isSelected: (value: string) => boolean;
	onSelect: (value: string) => void;
	searchPlaceholder?: string | undefined;
	emptyText?: string | undefined;
}) {
	return (
		// cmdk labels its search input from `label` (a visually hidden <label>); an
		// aria-label on the input itself would be overridden by cmdk's aria-labelledby.
		<Command label={searchPlaceholder ?? m.combobox_search()}>
			<CommandInput placeholder={searchPlaceholder ?? m.combobox_search()} />
			<CommandList id={listId}>
				<CommandEmpty>{emptyText ?? m.combobox_empty()}</CommandEmpty>
				<CommandGroup>
					{options.map((option) => (
						<CommandItem
							key={option.value}
							// cmdk filters on `value`; search by the visible label, keep the id as a keyword.
							value={option.label}
							keywords={[option.value]}
							onSelect={() => onSelect(option.value)}
						>
							<CheckIcon className={cn("size-4", isSelected(option.value) ? "opacity-100" : "opacity-0")} aria-hidden />
							{option.label}
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</Command>
	);
}

/** Searchable single choice. Stores the option value ("" when empty). */
export function ComboboxField({ label, description, optional, options, placeholder, ...list }: SearchableProps) {
	const field = useFieldContext<string>();
	const [open, setOpen] = useState(false);
	const selected = options.find((option) => option.value === field.state.value);
	return (
		<FieldShell label={label} description={description} optional={optional}>
			{(control) => (
				<Popover
					open={open}
					onOpenChange={(next) => {
						setOpen(next);
						if (!next) field.handleBlur();
					}}
				>
					<PopoverTrigger asChild>
						<Button
							{...control}
							type="button"
							variant="outline"
							role="combobox"
							aria-expanded={open}
							aria-controls={`${control.id}-listbox`}
							className="w-full justify-between font-normal"
						>
							<span className={cn(!selected && "text-muted-foreground")}>
								{selected?.label ?? placeholder ?? m.select_placeholder()}
							</span>
							<ChevronsUpDownIcon className="opacity-50" aria-hidden />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
						<OptionList
							listId={`${control.id}-listbox`}
							options={options}
							isSelected={(value) => value === field.state.value}
							onSelect={(value) => {
								field.handleChange(value === field.state.value ? "" : value);
								field.handleBlur();
								setOpen(false);
							}}
							{...list}
						/>
					</PopoverContent>
				</Popover>
			)}
		</FieldShell>
	);
}

/** Searchable multiple choice with removable chips. Stores string[]. */
export function MultiSelectField({ label, description, optional, options, placeholder, ...list }: SearchableProps) {
	const field = useFieldContext<string[]>();
	const [open, setOpen] = useState(false);
	const values = field.state.value ?? [];
	const toggle = (value: string) =>
		field.handleChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
	const labelOf = (value: string) => options.find((option) => option.value === value)?.label ?? value;

	const chips =
		values.length > 0 ? (
			<ul className="flex flex-wrap gap-1.5" data-testid="multiselect-chips">
				{values.map((value) => (
					<li key={value}>
						<Badge variant="secondary" className="gap-1 pe-1">
							{labelOf(value)}
							<button
								type="button"
								className="rounded-sm p-0.5 outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring"
								aria-label={m.multiselect_remove({ label: labelOf(value) })}
								onClick={() => {
									toggle(value);
									field.handleBlur();
								}}
							>
								<XIcon className="size-3" aria-hidden />
							</button>
						</Badge>
					</li>
				))}
			</ul>
		) : null;

	return (
		<FieldShell label={label} description={description} optional={optional} after={chips}>
			{(control) => (
				<Popover
					open={open}
					onOpenChange={(next) => {
						setOpen(next);
						if (!next) field.handleBlur();
					}}
				>
					<PopoverTrigger asChild>
						<Button
							{...control}
							type="button"
							variant="outline"
							role="combobox"
							aria-expanded={open}
							aria-controls={`${control.id}-listbox`}
							className="w-full justify-between font-normal"
						>
							<span className={cn(values.length === 0 && "text-muted-foreground")}>
								{values.length > 0
									? m.multiselect_selected({ count: formatNumber(values.length) })
									: (placeholder ?? m.select_placeholder())}
							</span>
							<ChevronsUpDownIcon className="opacity-50" aria-hidden />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
						<OptionList
							listId={`${control.id}-listbox`}
							options={options}
							isSelected={(value) => values.includes(value)}
							onSelect={toggle}
							{...list}
						/>
					</PopoverContent>
				</Popover>
			)}
		</FieldShell>
	);
}

// ---------------------------------------------------------------------------
// Radio, checkbox, switch
// ---------------------------------------------------------------------------

export type RadioGroupFieldProps = FieldBaseProps & { options: ReadonlyArray<FieldOption> };

export function RadioGroupField({ label, description, optional, options }: RadioGroupFieldProps) {
	const field = useFieldContext<string>();
	const a11y = useFieldA11y(label, { focusId: (id) => optionId(id, options[0]?.value ?? "option") });
	return (
		<FieldSet data-invalid={a11y.invalid || undefined}>
			<FieldLegend variant="label">
				<FieldLabelText label={label} optional={optional} />
			</FieldLegend>
			<RadioGroup
				name={field.name}
				value={field.state.value ?? ""}
				onValueChange={(value) => {
					field.handleChange(value);
					field.handleBlur();
				}}
				aria-invalid={a11y.invalid || undefined}
				aria-describedby={a11y.describedBy(Boolean(description))}
			>
				{options.map((option) => {
					const id = optionId(a11y.id, option.value);
					return (
						<Field key={option.value} orientation="horizontal">
							<RadioGroupItem id={id} value={option.value} aria-invalid={a11y.invalid || undefined} />
							<FieldContent>
								<FieldLabel htmlFor={id} className="font-normal">
									{option.label}
								</FieldLabel>
								{option.description ? <FieldDescription>{option.description}</FieldDescription> : null}
							</FieldContent>
						</Field>
					);
				})}
			</RadioGroup>
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</FieldSet>
	);
}

/** A single checkbox with its label beside it. Stores boolean. */
export function CheckboxField({
	label,
	description,
	disabled = false,
}: Omit<FieldBaseProps, "optional"> & { disabled?: boolean }) {
	const field = useFieldContext<boolean>();
	const a11y = useFieldA11y(label);
	return (
		<Field orientation="horizontal" data-invalid={a11y.invalid || undefined}>
			<Checkbox
				id={a11y.id}
				name={field.name}
				checked={field.state.value === true}
				disabled={disabled}
				onCheckedChange={(checked) => {
					field.handleChange(checked === true);
					field.handleBlur();
				}}
				aria-invalid={a11y.invalid || undefined}
				aria-describedby={a11y.describedBy(Boolean(description))}
			/>
			<FieldContent>
				<FieldLabel htmlFor={a11y.id} className="font-normal">
					{label}
				</FieldLabel>
				<FieldMessages
					descriptionId={a11y.descriptionId}
					description={description}
					errorId={a11y.errorId}
					errors={a11y.errors}
				/>
			</FieldContent>
		</Field>
	);
}

export type CheckboxGroupFieldProps = FieldBaseProps & { options: ReadonlyArray<FieldOption> };

/** Several checkboxes under one legend. Stores string[] of checked values. */
export function CheckboxGroupField({ label, description, optional, options }: CheckboxGroupFieldProps) {
	const field = useFieldContext<string[]>();
	const a11y = useFieldA11y(label, { focusId: (id) => optionId(id, options[0]?.value ?? "option") });
	const values = field.state.value ?? [];
	return (
		<FieldSet
			data-invalid={a11y.invalid || undefined}
			aria-invalid={a11y.invalid || undefined}
			aria-describedby={a11y.describedBy(Boolean(description))}
		>
			<FieldLegend variant="label">
				<FieldLabelText label={label} optional={optional} />
			</FieldLegend>
			<div className="flex flex-col gap-3">
				{options.map((option) => {
					const id = optionId(a11y.id, option.value);
					return (
						<Field key={option.value} orientation="horizontal">
							<Checkbox
								id={id}
								name={field.name}
								value={option.value}
								checked={values.includes(option.value)}
								disabled={option.disabled}
								onCheckedChange={(checked) => {
									field.handleChange(
										checked === true ? [...values, option.value] : values.filter((value) => value !== option.value),
									);
									field.handleBlur();
								}}
								aria-invalid={a11y.invalid || undefined}
							/>
							<FieldContent>
								<FieldLabel htmlFor={id} className="font-normal">
									{option.label}
								</FieldLabel>
								{option.description ? <FieldDescription>{option.description}</FieldDescription> : null}
							</FieldContent>
						</Field>
					);
				})}
			</div>
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</FieldSet>
	);
}

/** On/off setting with the label beside it. Stores boolean. */
export function SwitchField({ label, description }: Omit<FieldBaseProps, "optional">) {
	const field = useFieldContext<boolean>();
	const a11y = useFieldA11y(label);
	return (
		<Field orientation="horizontal" data-invalid={a11y.invalid || undefined}>
			<FieldContent>
				<FieldLabel htmlFor={a11y.id}>{label}</FieldLabel>
				<FieldMessages
					descriptionId={a11y.descriptionId}
					description={description}
					errorId={a11y.errorId}
					errors={a11y.errors}
				/>
			</FieldContent>
			<Switch
				id={a11y.id}
				name={field.name}
				checked={field.state.value === true}
				onCheckedChange={(checked) => {
					field.handleChange(checked);
					field.handleBlur();
				}}
				aria-invalid={a11y.invalid || undefined}
				aria-describedby={a11y.describedBy(Boolean(description))}
			/>
		</Field>
	);
}
