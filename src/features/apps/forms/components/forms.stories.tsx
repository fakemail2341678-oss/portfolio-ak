import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import type { FormField } from "../fields";
import { BuilderCanvas } from "./builder-canvas";
import { FieldSettings } from "./field-settings";
import { FormRenderer } from "./form-renderer";

const FIELDS: FormField[] = [
	{ id: "fname0001", type: "short_text", label: "Your name", help: "", required: true, maxLength: 80 },
	{
		id: "fstars001",
		type: "rating",
		label: "How was your visit?",
		help: "",
		required: true,
		lowLabel: "Poor",
		highLabel: "Excellent",
	},
	{
		id: "fdrink001",
		type: "single_select",
		label: "What did you drink?",
		help: "",
		required: false,
		options: [
			{ id: "otea000", label: "Tea" },
			{ id: "ocoffee", label: "Coffee" },
		],
		display: "radio",
	},
	{
		id: "forder001",
		type: "multi_select",
		label: "What did you eat?",
		help: "Tick all that apply.",
		required: false,
		options: [
			{ id: "omomo00", label: "Momo" },
			{ id: "ocake00", label: "Cake" },
		],
		maxChoices: null,
	},
	{
		id: "fguests01",
		type: "number",
		label: "How many of you?",
		help: "",
		required: false,
		min: 1,
		max: 20,
		integer: true,
	},
	{ id: "fday00001", type: "date", label: "Which day?", help: "", required: false, min: null, max: null },
	{ id: "femail001", type: "email", label: "Email", help: "", required: false },
	{ id: "fmore0001", type: "long_text", label: "Anything else?", help: "", required: false, maxLength: 500 },
	{ id: "fagree001", type: "consent", label: "You may quote my answers.", help: "", required: true },
];

const meta = {
	title: "Apps/Forms",
	component: FormRenderer,
	args: { fields: FIELDS, onSubmit: fn(async () => {}) },
} satisfies Meta<typeof FormRenderer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A form drawn from its definition: sending it empty shows the required questions' problems. */
export const RequiredAnswers: Story = {
	play: async ({ canvas, args }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.forms_submit() }));
		// The name and the rating are required; the consent box must be ticked.
		await expect(await canvas.findAllByText(m.validation_required())).toHaveLength(2);
		await expect(canvas.getByText(m.validation_must_accept())).toBeVisible();
		await expect(args.onSubmit).not.toHaveBeenCalled();
	},
};

/** Answered: the answers go out keyed by field id, choices as option ids. */
export const Answered: Story = {
	play: async ({ canvas, args }) => {
		await userEvent.type(canvas.getByLabelText(/Your name/), "Asha");
		// The rating's stars come first among the radios: the fourth is 4.
		await userEvent.click(canvas.getAllByRole("radio")[3] as HTMLElement);
		await userEvent.click(canvas.getByLabelText("Coffee"));
		await userEvent.click(canvas.getByLabelText("Momo"));
		await userEvent.click(canvas.getByLabelText("You may quote my answers."));
		await userEvent.click(canvas.getByRole("button", { name: m.forms_submit() }));
		await expect(args.onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				fname0001: "Asha",
				fstars001: 4,
				fdrink001: "ocoffee",
				forder001: ["omomo00"],
				fagree001: true,
			}),
		);
	},
};

/** The builder's palette and questions: a type is added from its button, a question moved with Alt + ↓. */
export const Builder: Story = {
	render: () => {
		const [fields, setFields] = useState<FormField[]>(FIELDS.slice(0, 3));
		const [selected, setSelected] = useState<string | null>(null);
		return (
			<div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
				<BuilderCanvas
					fields={fields}
					selectedId={selected}
					invalid={new Set(["fdrink001"])}
					onAdd={(type) => {
						const field = { ...FIELDS[6], id: "fnew00001", type } as FormField;
						setFields((current) => [...current, field]);
						return field;
					}}
					onMove={(from, to) =>
						setFields((current) => {
							const next = [...current];
							const [moved] = next.splice(from, 1);
							if (moved) next.splice(to, 0, moved);
							return next;
						})
					}
					onSelect={setSelected}
					onRemove={(field) => setFields((current) => current.filter((each) => each.id !== field.id))}
				/>
			</div>
		);
	},
	play: async ({ canvas }) => {
		const list = within(canvas.getByTestId("forms-fields"));
		await expect(list.getAllByTestId("forms-field")).toHaveLength(3);
		await userEvent.click(canvas.getByTestId("forms-add-email"));
		await expect(list.getAllByTestId("forms-field")).toHaveLength(4);
		await expect(canvas.getByTestId("forms-announcement")).toHaveTextContent(
			m.forms_added({ item: m.forms_type_email() }),
		);
		const handle = list.getByRole("button", { name: m.sortable_handle({ item: "Your name" }) });
		handle.focus();
		await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
		await expect(list.getAllByTestId("forms-field-select")[1]).toHaveTextContent("Your name");
	},
};

/** A choice question's settings: options are renamed, added and (down to two) removed. */
export const ChoiceSettings: Story = {
	render: () => {
		const [field, setField] = useState<FormField>(FIELDS[2] as FormField);
		return (
			<div className="max-w-sm rounded-lg border p-4">
				<FieldSettings
					field={field}
					errors={{ "options.1.label": [m.validation_required()] }}
					onChange={setField}
					onDuplicate={fn()}
					onRemove={fn()}
					onClose={fn()}
				/>
			</div>
		);
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText(m.validation_required())).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: m.forms_option_add() }));
		await expect(canvas.getAllByTestId("forms-option")).toHaveLength(3);
		await userEvent.click(canvas.getByRole("button", { name: m.forms_option_remove({ item: "Tea" }) }));
		await expect(canvas.getAllByTestId("forms-option")).toHaveLength(2);
		await expect(canvas.getByRole("button", { name: m.forms_option_remove({ item: "Coffee" }) })).toBeDisabled();
	},
};
