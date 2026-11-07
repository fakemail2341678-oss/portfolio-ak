import { useStore } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { withFieldGroup } from "../index";

/**
 * Text typed in both languages: the value is `{ en, ne }` (`Localized`, src/lib/i18n/localized.ts).
 * English and Nepali sit in tabs; the Nepali tab says "Nepali missing" while
 * it's empty (the site falls back to English there). Both stay mounted, so both
 * validate and appear in the error summary; a failed submit opens the tab that has
 * the error.
 *
 * Field groups (TanStack Form's `withFieldGroup`), placed with `form` and `fields`:
 *
 *   <LocalizedField form={form} fields="title" label={m.title()} />
 *   <LocalizedRichTextField form={form} fields="body" label={m.body()} optional />
 */

const LOCALIZED_DEFAULTS: Localized = { en: "", ne: "" };
const LANGUAGES = ["en", "ne"] as const;
const LANGUAGE_NAMES = { en: m.language_en, ne: m.language_ne } as const;

type GroupProps = {
	label: string;
	description?: string;
	optional?: boolean;
	/** A textarea instead of a one-line input. */
	multiline?: boolean;
	maxLength?: number;
};

const PROPS: GroupProps = { label: "" };

/** Which tab to show after a failed submit: the first language whose field has an error. */
function useErrorTab(errorsByLanguage: Record<(typeof LANGUAGES)[number], boolean>, attempts: number) {
	const [tab, setTab] = useState<(typeof LANGUAGES)[number]>("en");
	// Only on a new attempt: typing must not switch tabs under the cursor.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reacts to submit attempts only, not to every error change.
	useEffect(() => {
		if (attempts === 0) return;
		const first = LANGUAGES.find((language) => errorsByLanguage[language]);
		if (first) setTab(first);
	}, [attempts]);
	return [tab, setTab] as const;
}

function LocalizedTabs({
	label,
	description,
	nepaliMissing,
	tab,
	onTabChange,
	panel,
}: {
	label: string;
	description?: string | undefined;
	nepaliMissing: boolean;
	tab: (typeof LANGUAGES)[number];
	onTabChange: (tab: (typeof LANGUAGES)[number]) => void;
	panel: (language: (typeof LANGUAGES)[number]) => React.ReactNode;
}) {
	return (
		<fieldset className="flex min-w-0 flex-col gap-2">
			<legend className="sr-only">{label}</legend>
			<Tabs value={tab} onValueChange={(next) => onTabChange(next === "ne" ? "ne" : "en")}>
				<TabsList aria-label={m.localized_languages({ label })}>
					{LANGUAGES.map((language) => (
						<TabsTrigger key={language} value={language} lang={language}>
							{LANGUAGE_NAMES[language]()}
							{language === "ne" && nepaliMissing ? (
								<Badge variant="outline" className="ms-1 border-warning/40 px-1.5 py-0 text-warning" lang="en">
									{m.localized_missing()}
								</Badge>
							) : null}
						</TabsTrigger>
					))}
				</TabsList>
				{LANGUAGES.map((language) => (
					// Mounted when hidden: both languages validate and show in the error summary.
					<TabsContent key={language} value={language} forceMount className="data-[state=inactive]:hidden">
						{panel(language)}
					</TabsContent>
				))}
			</Tabs>
			{description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
		</fieldset>
	);
}

const fieldLabel = (label: string, language: (typeof LANGUAGES)[number]) =>
	m.localized_label({ label, language: LANGUAGE_NAMES[language]() });

export const LocalizedField = withFieldGroup({
	defaultValues: LOCALIZED_DEFAULTS,
	props: PROPS,
	render: function Render({ group, label, description, optional, multiline, maxLength }) {
		const values = useStore(group.store, (state) => state.values);
		const attempts = useStore(group.form.store, (state) => state.submissionAttempts);
		const errors = useStore(group.form.store, (state) => state.fieldMeta);
		const hasError = (language: (typeof LANGUAGES)[number]) =>
			(errors[group.getFormFieldName(language) as keyof typeof errors]?.errors?.length ?? 0) > 0;
		const [tab, setTab] = useErrorTab({ en: hasError("en"), ne: hasError("ne") }, attempts);
		return (
			<LocalizedTabs
				label={label}
				description={description}
				nepaliMissing={!values.ne.trim()}
				tab={tab}
				onTabChange={setTab}
				panel={(language) => (
					<group.AppField name={language}>
						{(field) =>
							multiline ? (
								<field.TextareaField
									label={fieldLabel(label, language)}
									optional={optional || language === "ne"}
									maxLength={maxLength}
									rows={4}
								/>
							) : (
								<field.TextField
									label={fieldLabel(label, language)}
									optional={optional || language === "ne"}
									maxLength={maxLength}
								/>
							)
						}
					</group.AppField>
				)}
			/>
		);
	},
});

export const LocalizedRichTextField = withFieldGroup({
	defaultValues: LOCALIZED_DEFAULTS,
	props: PROPS,
	render: function Render({ group, label, description, optional }) {
		const values = useStore(group.store, (state) => state.values);
		const attempts = useStore(group.form.store, (state) => state.submissionAttempts);
		const errors = useStore(group.form.store, (state) => state.fieldMeta);
		const hasError = (language: (typeof LANGUAGES)[number]) =>
			(errors[group.getFormFieldName(language) as keyof typeof errors]?.errors?.length ?? 0) > 0;
		const [tab, setTab] = useErrorTab({ en: hasError("en"), ne: hasError("ne") }, attempts);
		// Rich text is HTML: "<p></p>" is empty too.
		const nepaliMissing = !values.ne.replace(/<[^>]*>/g, "").trim();
		return (
			<LocalizedTabs
				label={label}
				description={description}
				nepaliMissing={nepaliMissing}
				tab={tab}
				onTabChange={setTab}
				panel={(language) => (
					<group.AppField name={language}>
						{(field) => (
							<field.RichTextField label={fieldLabel(label, language)} optional={optional || language === "ne"} />
						)}
					</group.AppField>
				)}
			/>
		);
	},
});
