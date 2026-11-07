import { CalendarIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fromIsoDate, type IsoDate, isoDateInstant, toIsoDate } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { toDevanagariDigits } from "@/lib/i18n/intl-ne";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldShell } from "../field-shell";
import { LocalizedCalendar } from "./localized-calendar";

const display = (value: IsoDate | undefined) =>
	value && fromIsoDate(value) ? formatDate(isoDateInstant(value), { dateStyle: "medium" }) : undefined;

type DateBounds = { min?: IsoDate; max?: IsoDate };

const disabledDays = ({ min, max }: DateBounds) => {
	const matchers = [];
	const minDate = fromIsoDate(min);
	const maxDate = fromIsoDate(max);
	if (minDate) matchers.push({ before: minDate });
	if (maxDate) matchers.push({ after: maxDate });
	return matchers;
};

export type DateFieldProps = FieldBaseProps & DateBounds & { placeholder?: string };

/** Calendar date picker. Stores "YYYY-MM-DD" ("" when empty); shows the date in the current language. */
export function DateField({ label, description, optional, placeholder, min, max }: DateFieldProps) {
	const field = useFieldContext<string>();
	const [open, setOpen] = useState(false);
	const value = field.state.value || undefined;
	const selected = fromIsoDate(value);
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
						<Button {...control} type="button" variant="outline" className="w-full justify-start font-normal">
							<CalendarIcon className="opacity-60" aria-hidden />
							<span className={cn(!value && "text-muted-foreground")}>
								{display(value) ?? placeholder ?? m.date_placeholder()}
							</span>
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<LocalizedCalendar
							mode="single"
							selected={selected}
							defaultMonth={selected}
							disabled={disabledDays({ ...(min ? { min } : {}), ...(max ? { max } : {}) })}
							onSelect={(date) => {
								field.handleChange(date ? toIsoDate(date) : "");
								field.handleBlur();
								setOpen(false);
							}}
						/>
					</PopoverContent>
				</Popover>
			)}
		</FieldShell>
	);
}

export type DateRangeValue = { from?: IsoDate; to?: IsoDate };

/** Two-month range picker. Stores { from, to } as "YYYY-MM-DD". */
export function DateRangeField({ label, description, optional, placeholder, min, max }: DateFieldProps) {
	const field = useFieldContext<DateRangeValue>();
	const [open, setOpen] = useState(false);
	const value = field.state.value ?? {};
	const from = fromIsoDate(value.from);
	const to = fromIsoDate(value.to);
	const text =
		value.from && value.to
			? m.date_range_value({ from: display(value.from) ?? "", to: display(value.to) ?? "" })
			: value.from
				? display(value.from)
				: undefined;
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
						<Button {...control} type="button" variant="outline" className="w-full justify-start font-normal">
							<CalendarIcon className="opacity-60" aria-hidden />
							<span className={cn(!text && "text-muted-foreground")}>
								{text ?? placeholder ?? m.date_range_placeholder()}
							</span>
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<LocalizedCalendar
							mode="range"
							numberOfMonths={2}
							selected={{ from, to } satisfies DateRange}
							defaultMonth={from}
							disabled={disabledDays({ ...(min ? { min } : {}), ...(max ? { max } : {}) })}
							onSelect={(range) => {
								field.handleChange({
									...(range?.from ? { from: toIsoDate(range.from) } : {}),
									...(range?.to ? { to: toIsoDate(range.to) } : {}),
								});
							}}
						/>
						<div className="flex justify-end border-t p-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => {
									field.handleChange({});
									field.handleBlur();
								}}
							>
								{m.date_clear()}
							</Button>
						</div>
					</PopoverContent>
				</Popover>
			)}
		</FieldShell>
	);
}

/** Accepts "1430", "14:30", "१४:३०", "9:05"; returns "HH:mm" or the raw text if it can't be read. */
export const normalizeTime = (input: string): string => {
	const latin = input.trim().replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966));
	const match = /^(\d{1,2})[:.]?(\d{2})$/.exec(latin);
	if (!match) return latin;
	const [, hours = "", minutes = ""] = match;
	return `${hours.padStart(2, "0")}:${minutes}`;
};

const localDigits = (value: string) => (getLocale() === "ne" ? toDevanagariDigits(value) : value);

/** 24-hour time as text ("HH:mm"); shown with the current language's digits. */
export function TimeField({ label, description, optional }: FieldBaseProps) {
	const field = useFieldContext<string>();
	const value = field.state.value ?? "";
	const [draft, setDraft] = useState(() => localDigits(value));
	const latest = useRef(draft);
	latest.current = draft;

	// Resync when the value changes from outside (reset, setFieldValue).
	useEffect(() => {
		if (normalizeTime(latest.current) !== value) setDraft(localDigits(value));
	}, [value]);

	return (
		<FieldShell label={label} description={description} optional={optional}>
			{(control) => (
				<Input
					{...control}
					type="text"
					inputMode="numeric"
					autoComplete="off"
					placeholder={m.time_placeholder()}
					value={draft}
					onChange={(event) => {
						setDraft(event.target.value);
						field.handleChange(normalizeTime(event.target.value));
					}}
					onBlur={() => {
						const normalized = normalizeTime(draft);
						if (/^\d{2}:\d{2}$/.test(normalized)) setDraft(localDigits(normalized));
						field.handleBlur();
					}}
				/>
			)}
		</FieldShell>
	);
}
