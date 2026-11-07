import { XIcon } from "lucide-react";
import { Slider as SliderPrimitive } from "radix-ui";
import { type KeyboardEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldLabelText, FieldMessages, FieldShell, useFieldA11y } from "../field-shell";

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

export type SliderFieldProps = FieldBaseProps & {
	min?: number;
	max?: number;
	step?: number;
	/** How the value is read out and displayed (default: locale number). */
	formatValue?: (value: number) => string;
};

/**
 * Single-value slider. Built on Radix directly (not the shadcn wrapper) so the
 * thumb, which is the focusable role="slider" element, gets the field's label,
 * description and a localized aria-valuetext.
 */
export function SliderField({
	label,
	description,
	optional,
	min = 0,
	max = 100,
	step = 1,
	formatValue = (value) => formatNumber(value),
}: SliderFieldProps) {
	const field = useFieldContext<number>();
	const a11y = useFieldA11y(label);
	const value = typeof field.state.value === "number" ? field.state.value : min;
	const labelId = `${a11y.id}-label`;
	return (
		<Field data-invalid={a11y.invalid || undefined}>
			<div className="flex items-center justify-between gap-4">
				<FieldLabel id={labelId}>
					<FieldLabelText label={label} optional={optional} />
				</FieldLabel>
				<output className="text-muted-foreground text-sm tabular-nums" aria-hidden>
					{formatValue(value)}
				</output>
			</div>
			<SliderPrimitive.Root
				name={field.name}
				min={min}
				max={max}
				step={step}
				value={[value]}
				onValueChange={([next]) => field.handleChange(next ?? min)}
				onValueCommit={() => field.handleBlur()}
				className="relative flex w-full touch-none select-none items-center py-2"
			>
				<SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
					<SliderPrimitive.Range className="absolute h-full bg-primary" />
				</SliderPrimitive.Track>
				<SliderPrimitive.Thumb
					id={a11y.id}
					aria-labelledby={labelId}
					aria-describedby={a11y.describedBy(Boolean(description))}
					aria-invalid={a11y.invalid || undefined}
					aria-valuetext={m.slider_value({ value: formatValue(value) })}
					onBlur={field.handleBlur}
					className="block size-4 rounded-full border border-primary bg-background shadow-sm outline-none ring-ring/50 transition-[box-shadow] hover:ring-4 focus-visible:ring-4"
				/>
			</SliderPrimitive.Root>
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</Field>
	);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export type TagsInputFieldProps = FieldBaseProps & { placeholder?: string };

/**
 * Free-form tags. Enter or comma adds a tag, Backspace on an empty input removes
 * the last one, pasting "a, b, c" adds several. Duplicates (case-insensitive) are
 * ignored. Stores string[]; limit count/length with tags() from validation.ts.
 */
export function TagsInputField({ label, description, optional, placeholder }: TagsInputFieldProps) {
	const field = useFieldContext<string[]>();
	const [draft, setDraft] = useState("");
	const values = field.state.value ?? [];

	const add = (raw: string) => {
		const incoming = raw
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
		if (incoming.length === 0) return;
		const next = [...values];
		for (const tag of incoming) {
			if (!next.some((existing) => existing.toLowerCase() === tag.toLowerCase())) next.push(tag);
		}
		field.handleChange(next);
		setDraft("");
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			add(draft);
		} else if (event.key === "Backspace" && draft === "" && values.length > 0) {
			field.handleChange(values.slice(0, -1));
		}
	};

	const chips =
		values.length > 0 ? (
			<ul className="flex flex-wrap gap-1.5" data-testid="tags-chips">
				{values.map((tag) => (
					<li key={tag}>
						<Badge variant="secondary" className="gap-1 pe-1">
							{tag}
							<button
								type="button"
								className="rounded-sm p-0.5 outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring"
								aria-label={m.tags_remove({ tag })}
								onClick={() => field.handleChange(values.filter((value) => value !== tag))}
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
				<Input
					{...control}
					type="text"
					autoComplete="off"
					enterKeyHint="enter"
					placeholder={placeholder ?? m.tags_placeholder()}
					value={draft}
					onChange={(event) => {
						const text = event.target.value;
						if (text.includes(",")) add(text);
						else setDraft(text);
					}}
					onKeyDown={onKeyDown}
					onBlur={() => {
						add(draft);
						control.onBlur();
					}}
				/>
			)}
		</FieldShell>
	);
}

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/** Native colour picker plus a hex text input, kept in sync. Stores "#rrggbb". */
export function ColorField({ label, description, optional }: FieldBaseProps) {
	const field = useFieldContext<string>();
	const a11y = useFieldA11y(label);
	const value = field.state.value ?? "";
	const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
	return (
		<Field data-invalid={a11y.invalid || undefined}>
			<FieldLabel htmlFor={a11y.id}>
				<FieldLabelText label={label} optional={optional} />
			</FieldLabel>
			<div className="flex items-center gap-2">
				<input
					type="color"
					aria-label={m.color_picker()}
					value={isHex ? value.toLowerCase() : "#000000"}
					onChange={(event) => field.handleChange(event.target.value)}
					onBlur={field.handleBlur}
					className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
				/>
				<Input
					id={a11y.id}
					name={field.name}
					type="text"
					autoComplete="off"
					spellCheck={false}
					placeholder="#000000"
					maxLength={7}
					value={value}
					aria-invalid={a11y.invalid || undefined}
					aria-describedby={a11y.describedBy(Boolean(description))}
					onChange={(event) => {
						const text = event.target.value.trim();
						field.handleChange(text && !text.startsWith("#") ? `#${text}` : text);
					}}
					onBlur={field.handleBlur}
					className="font-mono"
				/>
			</div>
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</Field>
	);
}
