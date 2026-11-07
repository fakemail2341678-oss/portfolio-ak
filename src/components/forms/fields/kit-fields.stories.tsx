import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { z } from "zod";
import { optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { formValidators, useAppForm } from "../index";
import { FieldStory } from "../story-harness";
import { AsyncComboboxField, RelationField } from "./async-combobox-field";
import { type Block, BlocksField, KeyValueField, SortableListField } from "./list-fields";
import { LocalizedField, LocalizedRichTextField } from "./localized-fields";
import { SlugField, slugValidators } from "./slug-field";

const CITIES = ["Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Biratnagar", "Dharan"].map((city) => ({
	value: city.toLowerCase(),
	label: city,
}));
/** A pretend server search: filters the cities after a short delay. */
const searchCities = {
	queryKey: ["story", "cities"],
	search: async (q: string) => {
		await new Promise((resolve) => setTimeout(resolve, 50));
		return CITIES.filter((city) => city.label.toLowerCase().includes(q.toLowerCase()));
	},
	debounceMs: 50,
};

const meta = {
	title: "Forms/Composite fields",
	component: SortableListField,
} satisfies Meta<typeof SortableListField>;
export default meta;
type Story = StoryObj<typeof meta>;

const args = { label: "", addLabel: "", newItem: () => "", renderItem: () => null };

/** Keyboard reorder: Alt + ↑ on a handle moves the entry and says so. */
export const SortableList: Story = {
	args,
	render: function Render() {
		const form = useAppForm({ defaultValues: { value: ["Plan", "Build", "Ship"] } });
		return (
			<form.AppForm>
				<form.Form className="max-w-md">
					<form.AppField name="value" mode="array">
						{() => (
							<SortableListField<string>
								label="Steps"
								addLabel="Add a step"
								newItem={() => ""}
								getItemLabel={(step) => step}
								renderItem={({ index }) => (
									<form.AppField name={`value[${index}]`}>
										{(field) => <field.TextField label={`Step ${index + 1}`} />}
									</form.AppField>
								)}
							/>
						)}
					</form.AppField>
				</form.Form>
			</form.AppForm>
		);
	},
	play: async ({ canvas, userEvent }) => {
		canvas.getByRole("button", { name: m.sortable_handle({ item: "Ship" }) }).focus();
		await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
		await waitFor(() => expect(canvas.getByRole("textbox", { name: "Step 2" })).toHaveValue("Ship"));
		await userEvent.click(canvas.getByRole("button", { name: "Add a step" }));
		await expect(canvas.getByRole("textbox", { name: "Step 4" })).toHaveValue("");
	},
};

type StoryBlock = (Block & { type: "heading"; text: string }) | (Block & { type: "quote"; text: string; cite: string });

export const Blocks: Story = {
	args,
	render: function Render() {
		const form = useAppForm({
			defaultValues: {
				value: [
					{ id: "b1", type: "heading", text: "Why momo" },
					{ id: "b2", type: "quote", text: "Steam, then fold.", cite: "A cook" },
				] as StoryBlock[],
			},
		});
		return (
			<form.AppForm>
				<form.Form className="max-w-xl">
					<form.AppField name="value" mode="array">
						{() => (
							<BlocksField<StoryBlock>
								label="Body"
								types={{
									heading: {
										label: () => "Heading",
										create: () => ({ id: crypto.randomUUID(), type: "heading", text: "" }),
										summary: (block) => block.text,
										render: ({ index }) => (
											<form.AppField name={`value[${index}].text`}>
												{(field) => <field.TextField label="Text" />}
											</form.AppField>
										),
									},
									quote: {
										label: () => "Quote",
										create: () => ({ id: crypto.randomUUID(), type: "quote", text: "", cite: "" }),
										summary: (block) => block.text,
										render: ({ index }) => (
											<form.AppField name={`value[${index}].text`}>
												{(field) => <field.TextareaField label="Quote" rows={2} />}
											</form.AppField>
										),
									},
								}}
							/>
						)}
					</form.AppField>
				</form.Form>
			</form.AppForm>
		);
	},
	play: async ({ canvas, userEvent, canvasElement }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.blocks_field_add() }));
		await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "Quote" }));
		await expect(canvas.getAllByRole("textbox", { name: "Quote" })).toHaveLength(2);
	},
};

export const KeyValue: Story = {
	args,
	render: () => (
		<FieldStory
			schema={z.array(z.object({ key: required({ max: 40 }), value: optionalText({ max: 200 }) }))}
			defaultValue={[{ key: "source", value: "story" }]}
		>
			<KeyValueField label="Metadata" keyLabel="Name" valueLabel="Value" />
		</FieldStory>
	),
};

export const AsyncCombobox: Story = {
	args,
	render: () => (
		<FieldStory schema={z.string()} defaultValue="">
			<AsyncComboboxField label="City" {...searchCities} />
		</FieldStory>
	),
	play: async ({ canvas, userEvent, canvasElement }) => {
		await userEvent.click(canvas.getByRole("combobox", { name: "City" }));
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.type(await body.findByRole("combobox", { name: m.combobox_search() }), "pur");
		await userEvent.click(await body.findByRole("option", { name: "Lalitpur" }));
		await expect(canvas.getByRole("combobox", { name: "City" })).toHaveTextContent("Lalitpur");
	},
};

export const Relation: Story = {
	args,
	render: () => (
		<FieldStory schema={z.array(z.string())} defaultValue={["pokhara"]}>
			<RelationField
				label="Cities"
				relation={searchCities}
				selected={[{ value: "pokhara", label: "Pokhara" }]}
				multiple
				max={3}
			/>
		</FieldStory>
	),
	play: async ({ canvas }) => {
		await expect(within(canvas.getByTestId("relation-chips")).getByText("Pokhara")).toBeVisible();
	},
};

/** The slug follows the title until edited; the link button links it again. "taken" is taken. */
export const Slug: Story = {
	args,
	render: function Render() {
		const form = useAppForm({
			defaultValues: { title: "", slug: "" },
			validators: formValidators(z.object({ title: z.string(), slug: z.string() })),
		});
		return (
			<form.AppForm>
				<form.Form className="max-w-md">
					<form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
					<form.AppField
						name="slug"
						validators={slugValidators({
							from: "title",
							debounceMs: 50,
							isAvailable: async (slug) => slug !== "taken",
						})}
					>
						{() => <SlugField label="Address" from="title" fromLabel="Title" prefix="/work/" />}
					</form.AppField>
				</form.Form>
			</form.AppForm>
		);
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByRole("textbox", { name: "Title" }), "Momo Kitchen!");
		await expect(canvas.getByRole("textbox", { name: "Address" })).toHaveValue("momo-kitchen");
		await userEvent.clear(canvas.getByRole("textbox", { name: "Address" }));
		await userEvent.type(canvas.getByRole("textbox", { name: "Address" }), "taken");
		// Errors show once the field is left (useFieldA11y).
		await userEvent.tab();
		await expect(await canvas.findByText(m.slug_field_taken())).toBeVisible();
	},
};

/** Both languages in tabs; the Nepali tab says when it's empty. */
export const Localized: Story = {
	args,
	render: function Render() {
		const form = useAppForm({
			defaultValues: { title: { en: "Momo Kitchen", ne: "" }, body: { en: "<p>Steamed dumplings.</p>", ne: "" } },
		});
		return (
			<form.AppForm>
				<form.Form className="max-w-xl">
					<LocalizedField form={form} fields="title" label="Title" />
					<LocalizedRichTextField form={form} fields="body" label="Body" optional />
				</form.Form>
			</form.AppForm>
		);
	},
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getAllByText(m.localized_missing())).toHaveLength(2);
		const [titleTabs] = canvas.getAllByRole("tablist");
		if (!titleTabs) throw new Error("no tabs");
		await userEvent.click(within(titleTabs).getByRole("tab", { name: new RegExp(m.language_ne()) }));
		// Nepali is optional: its label ends in "(optional)".
		await userEvent.type(
			canvas.getByRole("textbox", { name: new RegExp(`^Title \\(${m.language_ne()}\\)`) }),
			"मोमो किचन",
		);
		await waitFor(() => expect(canvas.getAllByText(m.localized_missing())).toHaveLength(1));
	},
};
