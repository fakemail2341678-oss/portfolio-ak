import { REGEXP_ONLY_DIGITS } from "input-otp";
import { type CountryCode, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import { ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldLabelText, FieldMessages, useFieldA11y } from "../field-shell";
import { OptionList } from "./choice-fields";

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * Region names come from Intl.DisplayNames in ENGLISH for both locales: desktop
 * Chrome ships no Nepali region names, so asking for "ne" would render different
 * text on the server (full ICU) and in the browser, i.e. a hydration mismatch.
 */
const regionNames = (() => {
	try {
		return new Intl.DisplayNames(["en"], { type: "region" });
	} catch {
		return undefined;
	}
})();

const COUNTRIES = getCountries()
	.map((code) => ({
		code,
		callingCode: getCountryCallingCode(code),
		name: regionNames?.of(code) ?? code,
	}))
	.sort((a, b) => a.name.localeCompare(b.name, "en"));

const digitsOnly = (value: string) =>
	value.replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966)).replace(/\D/g, "");

/** E.164 for a country + national digits ("" when no digits). */
const toE164 = (country: CountryCode, national: string) => {
	const digits = digitsOnly(national).replace(/^0+/, "");
	return digits ? `+${getCountryCallingCode(country)}${digits}` : "";
};

const fromE164 = (value: string | undefined, fallback: CountryCode) => {
	const parsed = value ? parsePhoneNumberFromString(value) : undefined;
	return parsed?.country
		? { country: parsed.country, national: parsed.formatNational() }
		: { country: fallback, national: value?.replace(/^\+\d+/, "") ?? "" };
};

export type PhoneFieldProps = FieldBaseProps & {
	/** Initial country when the value is empty. Defaults to Nepal (+977). */
	defaultCountry?: CountryCode;
};

/**
 * Country picker + national number. Stores E.164 ("+9779812345678"); validate
 * with phone() from src/lib/validation.ts (libphonenumber-js rules per country).
 * Accepts Devanagari digits, spaces and dashes; formats the number on blur.
 */
export function PhoneField({ label, description, optional, defaultCountry = "NP" }: PhoneFieldProps) {
	const field = useFieldContext<string>();
	const a11y = useFieldA11y(label);
	const value = field.state.value ?? "";
	const initial = useMemo(() => fromE164(value, defaultCountry), [value, defaultCountry]);
	const [country, setCountry] = useState<CountryCode>(initial.country);
	const [national, setNational] = useState(initial.national);
	const [open, setOpen] = useState(false);
	const latest = useRef({ country, national });
	latest.current = { country, national };

	// Resync from outside changes (reset, setFieldValue).
	useEffect(() => {
		if (toE164(latest.current.country, latest.current.national) !== value) {
			setCountry(initial.country);
			setNational(initial.national);
		}
	}, [value, initial]);

	const update = (nextCountry: CountryCode, nextNational: string) => {
		setCountry(nextCountry);
		setNational(nextNational);
		field.handleChange(toE164(nextCountry, nextNational));
	};

	const selected = COUNTRIES.find((entry) => entry.code === country);
	const describedBy = a11y.describedBy(Boolean(description));

	return (
		<Field data-invalid={a11y.invalid || undefined}>
			<FieldLabel htmlFor={a11y.id}>
				<FieldLabelText label={label} optional={optional} />
			</FieldLabel>
			<div className="flex gap-2">
				<Popover
					open={open}
					onOpenChange={(next) => {
						setOpen(next);
						if (!next) field.handleBlur();
					}}
				>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							role="combobox"
							aria-expanded={open}
							aria-controls={`${a11y.id}-countries`}
							aria-label={`${m.phone_country()}: ${selected?.name ?? country} +${selected?.callingCode ?? ""}`}
							className="shrink-0 font-normal"
						>
							{country} +{selected?.callingCode}
							<ChevronsUpDownIcon className="opacity-50" aria-hidden />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-72 p-0" align="start">
						<OptionList
							listId={`${a11y.id}-countries`}
							options={COUNTRIES.map((entry) => ({
								value: entry.code,
								label: `${entry.name} (+${entry.callingCode})`,
							}))}
							isSelected={(code) => code === country}
							onSelect={(code) => {
								const next = COUNTRIES.find((entry) => entry.code === code)?.code ?? country;
								update(next, national);
								setOpen(false);
							}}
						/>
					</PopoverContent>
				</Popover>
				<Input
					id={a11y.id}
					name={field.name}
					type="tel"
					inputMode="tel"
					autoComplete="tel-national"
					value={national}
					aria-invalid={a11y.invalid || undefined}
					aria-describedby={describedBy}
					onChange={(event) => update(country, event.target.value)}
					onBlur={() => {
						const parsed = parsePhoneNumberFromString(toE164(country, national));
						if (parsed?.isValid()) setNational(parsed.formatNational());
						field.handleBlur();
					}}
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

// ---------------------------------------------------------------------------
// One-time code
// ---------------------------------------------------------------------------

/**
 * Six-digit code boxes backed by a single real input (input-otp): pasting a whole
 * code fills every box, and autocomplete="one-time-code" lets phones offer the
 * code from an SMS/email.
 */
export function OtpField({ label, description, optional, length = 6 }: FieldBaseProps & { length?: number }) {
	const field = useFieldContext<string>();
	const a11y = useFieldA11y(label);
	return (
		<Field data-invalid={a11y.invalid || undefined}>
			<FieldLabel htmlFor={a11y.id}>
				<FieldLabelText label={label} optional={optional} />
			</FieldLabel>
			<InputOTP
				id={a11y.id}
				name={field.name}
				maxLength={length}
				pattern={REGEXP_ONLY_DIGITS}
				inputMode="numeric"
				autoComplete="one-time-code"
				value={field.state.value ?? ""}
				onChange={(value) => field.handleChange(value)}
				onBlur={field.handleBlur}
				aria-invalid={a11y.invalid || undefined}
				aria-describedby={a11y.describedBy(Boolean(description))}
			>
				<InputOTPGroup>
					{Array.from({ length }, (_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: slots are positional (one per digit).
						<InputOTPSlot key={index} index={index} aria-invalid={a11y.invalid || undefined} />
					))}
				</InputOTPGroup>
			</InputOTP>
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</Field>
	);
}
