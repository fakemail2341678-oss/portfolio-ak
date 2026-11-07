import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { currencySymbol, DEFAULT_CURRENCY, formatNumber, parseLocaleNumber } from "@/lib/i18n/intl";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldShell } from "../field-shell";

/**
 * Keeps what the user typed (e.g. "१२,५००") separate from the parsed number the
 * form stores, so partial input like "12." isn't clobbered while typing. External
 * changes (form reset) resync the draft.
 */
function useNumberDraft(format: (value: number) => string) {
	const field = useFieldContext<number | undefined>();
	const value = field.state.value;
	const [draft, setDraft] = useState(() => (typeof value === "number" && Number.isFinite(value) ? format(value) : ""));

	// Latest draft/format for the effect below, which should only re-run when the value changes.
	const latest = useRef({ draft, format });
	latest.current = { draft, format };

	// Resync only when the stored value changes from outside (reset, setFieldValue).
	useEffect(() => {
		const { draft, format } = latest.current;
		const parsed = parseLocaleNumber(draft);
		const matches =
			parsed === value || (parsed !== undefined && Number.isNaN(parsed) && value !== undefined && Number.isNaN(value));
		if (!matches) setDraft(typeof value === "number" && Number.isFinite(value) ? format(value) : "");
	}, [value]);

	return {
		field,
		draft,
		onChange: (text: string) => {
			setDraft(text);
			// NaN for unparseable text, so the schema reports "Enter a number".
			field.handleChange(parseLocaleNumber(text));
		},
		reformat: () => {
			const parsed = parseLocaleNumber(draft);
			if (parsed !== undefined && Number.isFinite(parsed)) setDraft(format(parsed));
		},
	};
}

export type NumberFieldProps = FieldBaseProps & {
	placeholder?: string;
	/** Whole numbers only: numeric keypad without a decimal key. */
	integer?: boolean;
};

/** Locale-aware number input. Stores `number | undefined` (NaN while the text isn't a number). */
export function NumberField({ label, description, optional, placeholder, integer }: NumberFieldProps) {
	const { draft, onChange } = useNumberDraft((value) => String(value));
	return (
		<FieldShell label={label} description={description} optional={optional}>
			{(control) => (
				<Input
					{...control}
					type="text"
					inputMode={integer ? "numeric" : "decimal"}
					autoComplete="off"
					placeholder={placeholder}
					value={draft}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</FieldShell>
	);
}

export type CurrencyFieldProps = FieldBaseProps & {
	/** ISO 4217 code; defaults to NPR. */
	currency?: string;
	placeholder?: string;
};

/**
 * Money input: currency symbol prefix for the current language (NPR / नेरू),
 * accepts Devanagari digits and grouping, reformats to two decimals with local
 * grouping on blur (१२,३४,५६७.५०). Stores a plain number.
 */
export function CurrencyField({
	label,
	description,
	optional,
	currency = DEFAULT_CURRENCY,
	placeholder,
}: CurrencyFieldProps) {
	const { field, draft, onChange, reformat } = useNumberDraft((value) =>
		formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
	);
	return (
		<FieldShell label={label} description={description} optional={optional}>
			{(control) => (
				<InputGroup>
					<InputGroupAddon>
						<InputGroupText>{currencySymbol(currency)}</InputGroupText>
					</InputGroupAddon>
					<InputGroupInput
						{...control}
						type="text"
						inputMode="decimal"
						autoComplete="off"
						placeholder={placeholder}
						value={draft}
						onChange={(event) => onChange(event.target.value)}
						onBlur={() => {
							reformat();
							field.handleBlur();
						}}
					/>
				</InputGroup>
			)}
		</FieldShell>
	);
}
