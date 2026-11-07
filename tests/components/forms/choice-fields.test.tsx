// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	CheckboxField,
	CheckboxGroupField,
	ComboboxField,
	type FieldOption,
	MultiSelectField,
	RadioGroupField,
	SelectField,
	SwitchField,
} from "@/components/forms/fields/choice-fields";
import { choice, choices, mustAccept } from "@/lib/validation";
import { expectInvalid, expectValid, renderField } from "./harness";

const districts: FieldOption[] = [
	{ value: "ktm", label: "Kathmandu" },
	{ value: "ltp", label: "Lalitpur" },
	{ value: "bkt", label: "Bhaktapur" },
];

describe("SelectField", () => {
	it("renders a labelled trigger with a placeholder", () => {
		renderField(<SelectField label="District" options={districts} />, { defaultValue: "", schema: choice() });
		const trigger = screen.getByLabelText("District");
		expect(trigger).toHaveTextContent("Select an option");
		expectValid(trigger);
	});

	it("selects an option and submits its value", async () => {
		const { user, submit, onSubmit } = renderField(<SelectField label="District" options={districts} />, {
			defaultValue: "",
			schema: choice(),
		});
		await user.click(screen.getByLabelText("District"));
		await user.click(await screen.findByRole("option", { name: "Lalitpur" }));
		expect(screen.getByLabelText("District")).toHaveTextContent("Lalitpur");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("ltp");
	});

	it("reports a missing choice on submit", async () => {
		const { submit } = renderField(<SelectField label="District" options={districts} />, {
			defaultValue: "",
			schema: choice(),
		});
		await submit();
		expectInvalid(screen.getByLabelText("District"), "This field is required.");
	});
});

describe("ComboboxField", () => {
	it("is an accessible combobox that searches and selects", async () => {
		const { user, submit, onSubmit } = renderField(<ComboboxField label="District" options={districts} />, {
			defaultValue: "",
			schema: choice(),
		});
		const trigger = screen.getByRole("combobox", { name: "District" });
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		await user.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		await user.type(screen.getByRole("combobox", { name: "Search…" }), "bhak");
		expect(screen.queryByRole("option", { name: "Kathmandu" })).not.toBeInTheDocument();
		await user.click(screen.getByRole("option", { name: "Bhaktapur" }));
		expect(trigger).toHaveTextContent("Bhaktapur");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("bkt");
	});

	it("shows the empty state and a required error", async () => {
		const { user, submit } = renderField(<ComboboxField label="District" options={districts} />, {
			defaultValue: "",
			schema: choice(),
		});
		await user.click(screen.getByRole("combobox", { name: "District" }));
		await user.type(screen.getByRole("combobox", { name: "Search…" }), "zzz");
		expect(screen.getByText("No results found.")).toBeInTheDocument();
		await user.keyboard("{Escape}");
		await submit();
		expectInvalid(screen.getByRole("combobox", { name: "District" }), "This field is required.");
	});
});

describe("MultiSelectField", () => {
	it("selects several options as removable chips", async () => {
		const { user, submit, onSubmit } = renderField(<MultiSelectField label="Districts" options={districts} />, {
			defaultValue: [],
			schema: choices({ min: 1 }),
		});
		const trigger = screen.getByRole("combobox", { name: "Districts" });
		await user.click(trigger);
		await user.click(screen.getByRole("option", { name: "Kathmandu" }));
		await user.click(screen.getByRole("option", { name: "Lalitpur" }));
		await user.keyboard("{Escape}");
		expect(trigger).toHaveTextContent("2 selected");
		const chips = screen.getByTestId("multiselect-chips");
		await user.click(within(chips).getByRole("button", { name: "Remove Kathmandu" }));
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(["ltp"]);
	});

	it("enforces the minimum number of choices", async () => {
		const { submit } = renderField(<MultiSelectField label="Districts" options={districts} />, {
			defaultValue: [],
			schema: choices({ min: 2 }),
		});
		await submit();
		expectInvalid(screen.getByRole("combobox", { name: "Districts" }), "Choose at least 2.");
	});
});

describe("RadioGroupField", () => {
	it("renders a labelled radio group and selects by label", async () => {
		const { user, submit, onSubmit } = renderField(<RadioGroupField label="District" options={districts} />, {
			defaultValue: "",
			schema: choice(),
		});
		const group = screen.getByRole("radiogroup");
		expect(screen.getByRole("group", { name: "District" })).toContainElement(group);
		await user.click(screen.getByLabelText("Bhaktapur"));
		expect(screen.getByRole("radio", { name: "Bhaktapur" })).toBeChecked();
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("bkt");
	});

	it("marks the group invalid when nothing is chosen", async () => {
		const { submit } = renderField(<RadioGroupField label="District" options={districts} />, {
			defaultValue: "",
			schema: choice(),
		});
		await submit();
		expectInvalid(screen.getByRole("radiogroup"), "This field is required.");
	});
});

describe("CheckboxField", () => {
	it("renders a labelled checkbox and requires acceptance", async () => {
		const { user, submit, onSubmit } = renderField(<CheckboxField label="I accept the terms" />, {
			defaultValue: false,
			schema: mustAccept(),
		});
		const checkbox = screen.getByRole("checkbox", { name: "I accept the terms" });
		expectValid(checkbox);
		await submit();
		expectInvalid(checkbox, "You must accept this to continue.");
		await user.click(checkbox);
		expect(checkbox).toBeChecked();
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(true);
	});
});

describe("CheckboxGroupField", () => {
	it("collects checked values under one legend", async () => {
		const { user, submit, onSubmit } = renderField(<CheckboxGroupField label="Districts" options={districts} />, {
			defaultValue: [],
			schema: choices({ min: 1 }),
		});
		expect(screen.getByRole("group", { name: "Districts" })).toBeInTheDocument();
		await user.click(screen.getByLabelText("Kathmandu"));
		await user.click(screen.getByLabelText("Bhaktapur"));
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(["ktm", "bkt"]);
	});

	it("reports too few choices on the group and every checkbox", async () => {
		const { submit } = renderField(<CheckboxGroupField label="Districts" options={districts} />, {
			defaultValue: [],
			schema: choices({ min: 1 }),
		});
		await submit();
		expectInvalid(screen.getByRole("group", { name: "Districts" }), "Choose at least 1.");
		expect(screen.getByLabelText("Kathmandu")).toHaveAttribute("aria-invalid", "true");
	});
});

describe("SwitchField", () => {
	it("renders a labelled switch that toggles and submits a boolean", async () => {
		const { user, submit, onSubmit } = renderField(
			<SwitchField label="Email notifications" description="Weekly summary only." />,
			{ defaultValue: false, schema: z.boolean() },
		);
		const toggle = screen.getByRole("switch", { name: "Email notifications" });
		expect(toggle).toHaveAttribute("aria-checked", "false");
		expect(toggle.getAttribute("aria-describedby")).toContain("-description");
		await user.click(toggle);
		expect(toggle).toHaveAttribute("aria-checked", "true");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(true);
	});

	it("shows errors from the schema", async () => {
		const { submit } = renderField(<SwitchField label="Enable" />, {
			defaultValue: false,
			schema: z.literal(true, { error: "Must be on." }),
		});
		await submit();
		expectInvalid(screen.getByRole("switch", { name: "Enable" }), "Must be on.");
	});
});
