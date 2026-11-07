import { ChevronDownIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { FilterField } from "./filter-bar";

/**
 * Filter controls for <FilterBar>. Each is a native form control with a `name`
 * (the URL param) and a default value from the URL, so it renders on the server
 * and works without JavaScript. FilterBar turns changes into URL updates.
 */

export type FilterOption = { value: string; label: string };

export function SearchFilter({
	name = "q",
	label,
	value,
	placeholder,
	hideLabel = false,
	className,
}: {
	name?: string;
	label: string;
	value: string;
	placeholder?: string;
	hideLabel?: boolean;
	className?: string;
}) {
	const id = useId();
	return (
		<FilterField id={id} label={label} hideLabel={hideLabel} className={cn("w-full sm:w-64", className)}>
			<Input id={id} name={name} type="search" defaultValue={value} placeholder={placeholder} autoComplete="off" />
		</FilterField>
	);
}

/** One choice from a short list. Use "" (or the param's default) as the "all" option's value. */
export function SelectFilter({
	name,
	label,
	value,
	options,
	className,
}: {
	name: string;
	label: string;
	value: string;
	options: ReadonlyArray<FilterOption>;
	className?: string;
}) {
	const id = useId();
	return (
		<FilterField id={id} label={label} className={cn("w-40", className)}>
			<NativeSelect id={id} name={name} defaultValue={value}>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</NativeSelect>
		</FilterField>
	);
}

/** Yes / no / any (the URL holds `true`, `false` or nothing). */
export function BooleanFilter({
	name,
	label,
	value,
	trueLabel = m.filters_yes(),
	falseLabel = m.filters_no(),
	className,
}: {
	name: string;
	label: string;
	value: boolean | undefined;
	trueLabel?: string;
	falseLabel?: string;
	className?: string;
}) {
	return (
		<SelectFilter
			name={name}
			label={label}
			value={value === undefined ? "" : String(value)}
			options={[
				{ value: "", label: m.filters_any() },
				{ value: "true", label: trueLabel },
				{ value: "false", label: falseLabel },
			]}
			className={className}
		/>
	);
}

/**
 * Several values from a list (`?tags=a&tags=b`), as checkboxes in a native
 * <details> dropdown: it opens and closes without JavaScript, and the panel
 * floats, so opening it never moves the page.
 */
export function MultiSelectFilter({
	name,
	label,
	value,
	options,
	className,
}: {
	name: string;
	label: string;
	value: ReadonlyArray<string>;
	options: ReadonlyArray<FilterOption>;
	className?: string;
}) {
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const legendId = useId();
	// Close on Escape or a click outside (a progressive enhancement; <details> works without it).
	useEffect(() => {
		const details = detailsRef.current;
		if (!details) return;
		const onPointerDown = (event: PointerEvent) => {
			if (details.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && details.open) {
				details.open = false;
				details.querySelector("summary")?.focus();
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		details.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			details.removeEventListener("keydown", onKeyDown);
		};
	}, []);
	const summary =
		value.length === 0 ? m.filters_any() : m.filters_selected_count({ count: formatNumber(value.length) });
	return (
		<div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
			<span id={legendId} className="font-medium text-sm leading-none">
				{label}
			</span>
			<details ref={detailsRef} className="group relative">
				<summary
					aria-describedby={legendId}
					className="flex h-(--control-height) w-44 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-details-marker]:hidden"
				>
					<span className="truncate">
						<span className="sr-only">{label}: </span>
						{summary}
					</span>
					<ChevronDownIcon className="size-4 shrink-0 opacity-50 group-open:rotate-180" aria-hidden />
				</summary>
				<fieldset className="absolute start-0 top-full z-20 mt-1 flex max-h-64 min-w-44 flex-col gap-1 overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
					<legend className="sr-only">{label}</legend>
					{options.length === 0 ? <p className="px-1 text-muted-foreground text-sm">{m.filters_no_options()}</p> : null}
					{options.map((option) => (
						<label
							key={option.value}
							className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-accent"
						>
							<input
								type="checkbox"
								name={name}
								value={option.value}
								defaultChecked={value.includes(option.value)}
								className="size-4 accent-primary"
							/>
							{option.label}
						</label>
					))}
				</fieldset>
			</details>
		</div>
	);
}

function RangeFilter({
	label,
	names,
	values,
	type,
	inputProps,
	className,
}: {
	label: string;
	names: readonly [string, string];
	values: readonly [string, string];
	type: "number" | "date";
	inputProps?: { min?: number; max?: number; step?: number | string };
	className?: string;
}) {
	const [fromId, toId] = [useId(), useId()];
	const [fromLabel, toLabel] =
		type === "date" ? [m.filters_from(), m.filters_to()] : [m.filters_min(), m.filters_max()];
	return (
		<fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)}>
			<legend className="mb-1.5 font-medium text-sm leading-none">{label}</legend>
			<div className="flex items-center gap-2">
				<label htmlFor={fromId} className="sr-only">
					{`${label}: ${fromLabel}`}
				</label>
				<Input
					id={fromId}
					name={names[0]}
					type={type}
					defaultValue={values[0]}
					placeholder={fromLabel}
					className={type === "number" ? "w-24" : "w-36"}
					{...inputProps}
				/>
				<span aria-hidden className="text-muted-foreground">
					–
				</span>
				<label htmlFor={toId} className="sr-only">
					{`${label}: ${toLabel}`}
				</label>
				<Input
					id={toId}
					name={names[1]}
					type={type}
					defaultValue={values[1]}
					placeholder={toLabel}
					className={type === "number" ? "w-24" : "w-36"}
					{...inputProps}
				/>
			</div>
		</fieldset>
	);
}

const text = (value: number | string | undefined) => (value === undefined ? "" : String(value));

/** Minimum and maximum (`?priceMin=100&priceMax=500`). */
export function NumberRangeFilter({
	label,
	names,
	value,
	min = 0,
	step = "any",
	className,
}: {
	label: string;
	names: readonly [string, string];
	value: readonly [number | undefined, number | undefined];
	min?: number;
	step?: number | "any";
	className?: string;
}) {
	return (
		<RangeFilter
			label={label}
			names={names}
			values={[text(value[0]), text(value[1])]}
			type="number"
			inputProps={{ min, step }}
			className={className}
		/>
	);
}

/** From and to dates (`?from=2026-01-01&to=2026-03-31`), inclusive. */
export function DateRangeFilter({
	label,
	names,
	value,
	className,
}: {
	label: string;
	names: readonly [string, string];
	value: readonly [string | undefined, string | undefined];
	className?: string;
}) {
	return (
		<RangeFilter
			label={label}
			names={names}
			values={[text(value[0]), text(value[1])]}
			type="date"
			className={className}
		/>
	);
}
