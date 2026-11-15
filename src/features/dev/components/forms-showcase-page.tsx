import { useState } from "react";
import { z } from "zod";
import { formValidators, useAppForm } from "@/components/forms";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { RichTextContent } from "@/components/rich-text-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { phone } from "@/lib/phone";
import type { SafeHtml } from "@/lib/safe-html";
import {
	choice,
	choices,
	currency,
	dateRange,
	files,
	hexColor,
	isoDate,
	mustAccept,
	numberRange,
	optionalText,
	otp,
	required,
	richText,
	tags,
	time,
	url,
} from "@/lib/validation";
import { m } from "@/paraglide/messages";

// Everything below is built inside functions, never at module level: the module
// then has no side effects, so the production bundler drops it entirely when the
// route renders `() => null` (see src/routes/dev/forms.tsx).

const MB = 1024 * 1024;

const createSchema = () =>
	z.object({
		name: required({ max: 80 }),
		bio: optionalText({ max: 200 }),
		website: url({ optional: true }),
		quantity: numberRange({ min: 1, max: 99, integer: true }),
		price: currency({ max: 1_000_000 }),
		district: choice(),
		districts: choices(),
		plan: choice(),
		interests: choices(),
		terms: mustAccept(),
		newsletter: z.boolean(),
		phone: phone(),
		code: otp(),
		date: isoDate({ min: "2020-01-01" }),
		range: dateRange(),
		time: time(),
		volume: numberRange({ min: 0, max: 100 }),
		tags: tags({ max: 5 }),
		color: hexColor(),
		attachments: files({ maxBytes: 5 * MB, accept: ["application/pdf", "image/*"], max: 3 }),
		avatar: files({ maxBytes: 2 * MB, accept: ["image/png", "image/jpeg", "image/webp"], min: 1 }),
		body: richText({ max: 2000 }),
	});

type Values = z.input<ReturnType<typeof createSchema>>;

const createDefaultValues = (): Values => ({
	name: "",
	bio: "",
	website: "",
	quantity: 1,
	price: 0,
	district: "",
	districts: [],
	plan: "",
	interests: [],
	terms: false,
	newsletter: false,
	phone: "",
	code: "",
	date: "",
	range: {},
	time: "",
	volume: 50,
	tags: [],
	color: "#2563eb",
	attachments: [],
	avatar: [],
	body: "",
});

// Real district names are proper nouns; shown as-is in both languages.
const createDistricts = () =>
	["Kathmandu", "Lalitpur", "Bhaktapur", "Kaski", "Chitwan", "Morang", "Jhapa"].map((name) => ({
		value: name.toLowerCase(),
		label: name,
	}));

/** JSON-friendly view of the submitted values (File objects become name/size/type). */
const describe = (values: Values) =>
	JSON.stringify(
		values,
		(_key, value: unknown) =>
			value instanceof File ? { name: value.name, size: value.size, type: value.type } : value,
		2,
	);

/** Every form field (parts 1 and 2) in one validated form. Rendered at /dev/forms in development only. */
export function FormsShowcase() {
	const [submitted, setSubmitted] = useState<{ json: string; html: SafeHtml } | null>(null);
	const [setup] = useState(() => ({
		schema: createSchema(),
		defaultValues: createDefaultValues(),
		districts: createDistricts(),
	}));
	const form = useAppForm({
		defaultValues: setup.defaultValues,
		validators: formValidators(setup.schema),
		onSubmit: async ({ value }) => {
			const { previewRichText } = await import("@/functions/dev");
			const { html } = await previewRichText({ data: { html: value.body } });
			setSubmitted({ json: describe(value), html });
		},
	});

	const plans = [
		{ value: "free", label: m.showcase_plan_free() },
		{ value: "pro", label: m.showcase_plan_pro() },
	];
	const interests = [
		{ value: "design", label: m.showcase_interest_design() },
		{ value: "code", label: m.showcase_interest_code() },
		{ value: "writing", label: m.showcase_interest_writing() },
	];

	return (
		<main {...MAIN_CONTENT} className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
			<header className="flex flex-col gap-2">
				<h1 className="font-semibold text-3xl tracking-tight">{m.showcase_title()}</h1>
				<p className="text-muted-foreground">{m.showcase_intro()}</p>
			</header>
			<form.AppForm>
				<form.Form className="flex flex-col gap-8">
					<form.FormErrorSummary />
					<Card>
						<CardHeader>
							<CardTitle>
								<h2>{m.showcase_section_text()}</h2>
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-6">
							<form.AppField name="name">{(f) => <f.TextField label={m.showcase_name()} />}</form.AppField>
							<form.AppField name="bio">
								{(f) => <f.TextareaField label={m.showcase_bio()} optional maxLength={200} showCount />}
							</form.AppField>
							<form.AppField name="website">
								{(f) => <f.UrlField label={m.showcase_website()} optional />}
							</form.AppField>
							<form.AppField name="body">{(f) => <f.RichTextField label={m.showcase_body()} />}</form.AppField>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>
								<h2>{m.showcase_section_numbers()}</h2>
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-6">
							<form.AppField name="quantity">
								{(f) => <f.NumberField label={m.showcase_quantity()} integer />}
							</form.AppField>
							<form.AppField name="price">{(f) => <f.CurrencyField label={m.showcase_price()} />}</form.AppField>
							<form.AppField name="volume">{(f) => <f.SliderField label={m.showcase_volume()} />}</form.AppField>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>
								<h2>{m.showcase_section_choices()}</h2>
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-6">
							<form.AppField name="district">
								{(f) => <f.ComboboxField label={m.showcase_district()} options={setup.districts} />}
							</form.AppField>
							<form.AppField name="districts">
								{(f) => <f.MultiSelectField label={m.showcase_districts()} options={setup.districts} />}
							</form.AppField>
							<form.AppField name="plan">
								{(f) => <f.RadioGroupField label={m.showcase_plan()} options={plans} />}
							</form.AppField>
							<form.AppField name="interests">
								{(f) => <f.CheckboxGroupField label={m.showcase_interests()} options={interests} />}
							</form.AppField>
							<form.AppField name="tags">{(f) => <f.TagsInputField label={m.showcase_tags()} />}</form.AppField>
							<form.AppField name="terms">{(f) => <f.CheckboxField label={m.showcase_terms()} />}</form.AppField>
							<form.AppField name="newsletter">
								{(f) => <f.SwitchField label={m.showcase_newsletter()} />}
							</form.AppField>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>
								<h2>{m.showcase_section_dates()}</h2>
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-6">
							<form.AppField name="date">
								{(f) => <f.DateField label={m.showcase_date()} min="2020-01-01" />}
							</form.AppField>
							<form.AppField name="range">{(f) => <f.DateRangeField label={m.showcase_range()} />}</form.AppField>
							<form.AppField name="time">{(f) => <f.TimeField label={m.showcase_time()} />}</form.AppField>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>
								<h2>{m.showcase_section_advanced()}</h2>
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-6">
							<form.AppField name="phone">{(f) => <f.PhoneField label={m.showcase_phone()} />}</form.AppField>
							<form.AppField name="code">{(f) => <f.OtpField label={m.showcase_code()} />}</form.AppField>
							<form.AppField name="color">{(f) => <f.ColorField label={m.showcase_color()} />}</form.AppField>
							<form.AppField name="attachments">
								{(f) => (
									<f.FileField
										label={m.showcase_attachments()}
										optional
										multiple
										maxBytes={5 * MB}
										accept={["application/pdf", "image/*"]}
									/>
								)}
							</form.AppField>
							<form.AppField name="avatar">
								{(f) => <f.ImageField label={m.showcase_avatar()} maxBytes={2 * MB} />}
							</form.AppField>
						</CardContent>
					</Card>
					<div className="flex gap-2">
						<form.SubmitButton>{m.showcase_submit()}</form.SubmitButton>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								form.reset();
								setSubmitted(null);
							}}
						>
							{m.showcase_reset()}
						</Button>
					</div>
				</form.Form>
			</form.AppForm>
			{submitted ? (
				<section className="flex flex-col gap-4" aria-labelledby="showcase-result">
					<h2 id="showcase-result" className="font-semibold text-xl">
						{m.showcase_submitted()}
					</h2>
					<pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">{submitted.json}</pre>
					<h3 className="font-semibold">{m.showcase_preview()}</h3>
					<RichTextContent html={submitted.html} className="rounded-md border p-4" />
				</section>
			) : null}
		</main>
	);
}
