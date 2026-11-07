import { HeadingIcon, PilcrowIcon, QuoteIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DescriptionList } from "@/components/data-display/description-list";
import { formValidators, useAppForm } from "@/components/forms";
import { AsyncComboboxField, type Relation, RelationField } from "@/components/forms/fields/async-combobox-field";
import { type Block, BlocksField, KeyValueField, SortableListField } from "@/components/forms/fields/list-fields";
import { LocalizedField, LocalizedRichTextField } from "@/components/forms/fields/localized-fields";
import { SlugField, slugValidators } from "@/components/forms/fields/slug-field";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { listExampleTasks } from "@/functions/examples";
import { formatNumber } from "@/lib/i18n/intl";
import { SLUG_PATTERN } from "@/lib/slug";
import { optionalText, required, richText } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { ExamplePage } from "./example-page";
import { PRIORITY_LABELS } from "./labels";
import { EXAMPLE_SEARCH_DEFAULTS } from "./schema";

/**
 * /dev/examples/fields: the kit's composite fields in one form, laid out with
 * FormSection and saved from a StickyFormBar. Nothing is stored: a submit shows
 * the values it would send.
 */

type ExampleBlock =
	| (Block & { type: "heading"; text: string })
	| (Block & { type: "paragraph"; text: string })
	| (Block & { type: "quote"; text: string; cite: string });

const newId = () => crypto.randomUUID();

/** Slugs this demo pretends are taken (a real form calls a server function, see test-crud-form.tsx). */
const TAKEN = new Set(["taken", "hello-world"]);
const isAvailable = (slug: string) =>
	new Promise<boolean>((resolve) => setTimeout(() => resolve(!TAKEN.has(slug)), 300));

/** Example tasks as options: the relation searches the tasks' own list function. */
const tasks: Relation = {
	queryKey: ["examples", "tasks", "options"],
	search: async (q) => {
		const page = await listExampleTasks({ data: { ...EXAMPLE_SEARCH_DEFAULTS, q } });
		return page.items.map((task) => ({
			value: task.id,
			label: task.title,
			description: PRIORITY_LABELS[task.priority](),
		}));
	},
};

const createSchema = () => {
	const localizedText = z.object({ en: required({ max: 80 }), ne: optionalText({ max: 80 }) });
	return z.object({
		title: localizedText,
		slug: z.string().regex(SLUG_PATTERN, { error: () => m.validation_slug() }),
		body: z.object({ en: richText({ max: 2000 }), ne: richText({ max: 2000 }) }),
		steps: z.array(required({ max: 120 })).max(8),
		blocks: z
			.array(
				z.discriminatedUnion("type", [
					z.object({ id: z.string(), type: z.literal("heading"), text: required({ max: 80 }) }),
					z.object({ id: z.string(), type: z.literal("paragraph"), text: required({ max: 500 }) }),
					z.object({
						id: z.string(),
						type: z.literal("quote"),
						text: required({ max: 300 }),
						cite: optionalText({ max: 80 }),
					}),
				]),
			)
			.max(10),
		metadata: z.array(z.object({ key: required({ max: 40 }), value: optionalText({ max: 200 }) })).max(10),
		owner: z.string(),
		related: z.array(z.string()).max(5),
	});
};

type Values = z.input<ReturnType<typeof createSchema>>;

const createDefaults = (): Values => ({
	title: { en: "", ne: "" },
	slug: "",
	body: { en: "", ne: "" },
	steps: [m.kit_fields_step_sample()],
	blocks: [{ id: newId(), type: "heading", text: m.kit_fields_block_sample() }],
	metadata: [{ key: "source", value: "dev" }],
	owner: "",
	related: [],
});

export function KitFieldsExample() {
	const [sent, setSent] = useState<Values | null>(null);
	const form = useAppForm({
		defaultValues: createDefaults(),
		validators: formValidators(createSchema()),
		onSubmit: ({ value, formApi }) => {
			setSent(value);
			toast.success(m.kit_fields_sent());
			formApi.reset(value);
		},
	});
	return (
		<ExamplePage slug="fields">
			<form.AppForm>
				<form.Form className="gap-8" data-testid="kit-fields-form">
					<form.FormErrorSummary />
					<FormSection title={m.kit_fields_content()} description={m.kit_fields_content_note()}>
						<LocalizedField form={form} fields="title" label={m.kit_fields_title()} maxLength={80} />
						<form.AppField name="slug" validators={slugValidators({ from: "title.en", isAvailable })}>
							{() => (
								<SlugField
									label={m.kit_fields_slug()}
									from="title.en"
									fromLabel={m.kit_fields_title()}
									prefix="/notes/"
								/>
							)}
						</form.AppField>
						<LocalizedRichTextField form={form} fields="body" label={m.kit_fields_body()} optional />
					</FormSection>
					<FormSection title={m.kit_fields_structure()} description={m.kit_fields_structure_note()}>
						<form.AppField name="steps" mode="array">
							{() => (
								<SortableListField<string>
									label={m.kit_fields_steps()}
									addLabel={m.kit_fields_add_step()}
									newItem={() => ""}
									max={8}
									getItemLabel={(step, index) => step || m.kit_fields_step_n({ n: formatNumber(index + 1) })}
									renderItem={({ index }) => (
										<form.AppField name={`steps[${index}]`}>
											{(field) => <field.TextField label={m.kit_fields_step_n({ n: formatNumber(index + 1) })} />}
										</form.AppField>
									)}
								/>
							)}
						</form.AppField>
						<form.AppField name="blocks" mode="array">
							{() => (
								<BlocksField<ExampleBlock>
									label={m.kit_fields_blocks()}
									max={10}
									types={{
										heading: {
											label: m.kit_block_heading,
											icon: <HeadingIcon aria-hidden />,
											create: () => ({ id: newId(), type: "heading", text: "" }),
											summary: (block) => block.text,
											render: ({ index }) => (
												<form.AppField name={`blocks[${index}].text`}>
													{(field) => <field.TextField label={m.kit_block_text()} />}
												</form.AppField>
											),
										},
										paragraph: {
											label: m.kit_block_paragraph,
											icon: <PilcrowIcon aria-hidden />,
											create: () => ({ id: newId(), type: "paragraph", text: "" }),
											summary: (block) => block.text,
											render: ({ index }) => (
												<form.AppField name={`blocks[${index}].text`}>
													{(field) => <field.TextareaField label={m.kit_block_text()} rows={3} />}
												</form.AppField>
											),
										},
										quote: {
											label: m.kit_block_quote,
											icon: <QuoteIcon aria-hidden />,
											create: () => ({ id: newId(), type: "quote", text: "", cite: "" }),
											summary: (block) => block.text,
											render: ({ index }) => (
												<>
													<form.AppField name={`blocks[${index}].text`}>
														{(field) => <field.TextareaField label={m.kit_block_text()} rows={2} />}
													</form.AppField>
													<form.AppField name={`blocks[${index}].cite`}>
														{(field) => <field.TextField label={m.kit_block_cite()} optional />}
													</form.AppField>
												</>
											),
										},
									}}
								/>
							)}
						</form.AppField>
						<form.AppField name="metadata" mode="array">
							{() => (
								<KeyValueField
									label={m.kit_fields_metadata()}
									keyLabel={m.kit_fields_key()}
									valueLabel={m.kit_fields_value()}
									optional
									max={10}
								/>
							)}
						</form.AppField>
					</FormSection>
					<FormSection title={m.kit_fields_relations()} description={m.kit_fields_relations_note()}>
						<form.AppField name="owner">
							{() => <AsyncComboboxField label={m.kit_fields_owner()} optional {...tasks} />}
						</form.AppField>
						<form.AppField name="related">
							{() => <RelationField label={m.kit_fields_related()} optional relation={tasks} multiple max={5} />}
						</form.AppField>
					</FormSection>
					<StickyFormBar
						submitLabel={m.kit_fields_send()}
						cancel={
							<Button type="button" variant="ghost" onClick={() => form.reset()}>
								{m.kit_fields_reset()}
							</Button>
						}
					/>
				</form.Form>
			</form.AppForm>
			{sent ? (
				<DescriptionList
					items={[
						{ label: m.kit_fields_title(), value: `${sent.title.en} / ${sent.title.ne || "—"}` },
						{ label: m.kit_fields_slug(), value: sent.slug, testId: "sent-slug" },
						{ label: m.kit_fields_steps(), value: sent.steps.join(" → "), testId: "sent-steps" },
						{ label: m.kit_fields_blocks(), value: sent.blocks.map((block) => block.type).join(", ") },
						{ label: m.kit_fields_related(), value: formatNumber(sent.related.length) },
					]}
				/>
			) : null}
		</ExamplePage>
	);
}
