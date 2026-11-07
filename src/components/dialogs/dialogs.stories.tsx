import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, waitFor, within } from "storybook/test";
import { z } from "zod";
import { formValidators, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { useConfirm } from "./confirm";
import { FormDialog, FormSheet } from "./form-dialog";

const onAnswer = fn();
const onSave = fn();

function ConfirmDemo() {
	const confirm = useConfirm();
	return (
		<Button
			variant="destructive"
			onClick={async () =>
				onAnswer(
					await confirm({
						title: "Delete this item?",
						description: "Momo Kitchen will be removed. This can't be undone.",
						confirmLabel: "Delete",
						destructive: true,
					}),
				)
			}
		>
			Delete
		</Button>
	);
}

function FormDemo({ kind }: { kind: "dialog" | "sheet" }) {
	const [open, setOpen] = useState(false);
	const form = useAppForm({
		defaultValues: { name: "" },
		validators: formValidators(z.object({ name: required({ max: 40 }) })),
		onSubmit: ({ value }) => {
			onSave(value.name);
			setOpen(false);
		},
	});
	const Overlay = kind === "dialog" ? FormDialog : FormSheet;
	return (
		<>
			<Button variant="outline" onClick={() => setOpen(true)}>
				Rename
			</Button>
			{open ? (
				<form.AppForm>
					<Overlay title="Rename the role" submitLabel="Save" onClose={() => setOpen(false)}>
						<form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
					</Overlay>
				</form.AppForm>
			) : null}
		</>
	);
}

const meta = { title: "Dialogs/Kit", component: ConfirmDemo } satisfies Meta<typeof ConfirmDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** useConfirm resolves true or false; focus starts on Cancel, so Enter never destroys anything by accident. */
export const Confirm: Story = {
	play: async ({ canvas, userEvent, canvasElement }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Delete" }));
		const body = within(canvasElement.ownerDocument.body);
		const cancel = await body.findByRole("button", { name: m.common_cancel() });
		await expect(cancel).toHaveFocus();
		await userEvent.click(cancel);
		await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(false));
		// The page is aria-hidden until the dialog has finished closing.
		await waitFor(() => expect(body.queryByRole("alertdialog")).toBeNull());
		await userEvent.click(canvas.getByRole("button", { name: "Delete" }));
		await userEvent.click(await body.findByTestId("confirm-action"));
		await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(true));
	},
};

/** An empty submit shows the error summary; closing with a change asks before discarding it. */
export const Dialog: Story = {
	render: () => <FormDemo kind="dialog" />,
	play: async ({ canvas, userEvent, canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(canvas.getByRole("button", { name: "Rename" }));
		await userEvent.click(await body.findByRole("button", { name: "Save" }));
		await expect(await body.findByTestId("form-error-summary")).toBeVisible();
		await userEvent.type(body.getByRole("textbox", { name: "Name" }), "Writers");
		await userEvent.click(body.getByRole("button", { name: m.common_cancel() }));
		await expect(await body.findByRole("alertdialog")).toHaveTextContent(m.unsaved_title());
		await userEvent.click(body.getByRole("button", { name: m.unsaved_stay() }));
		await waitFor(() => expect(body.queryByRole("alertdialog")).toBeNull());
		await userEvent.click(await body.findByRole("button", { name: "Save" }));
		await waitFor(() => expect(onSave).toHaveBeenCalledWith("Writers"));
	},
};

export const Sheet: Story = {
	render: () => <FormDemo kind="sheet" />,
	play: async ({ canvas, userEvent, canvasElement }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Rename" }));
		await expect(await within(canvasElement.ownerDocument.body).findByRole("dialog")).toHaveTextContent(
			"Rename the role",
		);
	},
};
