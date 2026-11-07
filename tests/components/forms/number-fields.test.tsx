// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencyField, NumberField } from "@/components/forms/fields/number-fields";
import { currency, numberRange } from "@/lib/validation";
import { expectInvalid, expectValid, renderField } from "./harness";

describe("NumberField", () => {
	it("renders a labelled decimal input", () => {
		renderField(<NumberField label="Quantity" description="Between 1 and 10." />, {
			defaultValue: undefined,
			schema: numberRange({ min: 1, max: 10 }),
		});
		const input = screen.getByLabelText("Quantity");
		expect(input).toHaveAttribute("inputmode", "decimal");
		expectValid(input);
	});

	it("accepts Devanagari digits and submits a number", async () => {
		const { user, submit, onSubmit } = renderField(<NumberField label="Quantity" />, {
			defaultValue: undefined,
			schema: numberRange({ min: 1, max: 20 }),
		});
		await user.type(screen.getByLabelText("Quantity"), "१२");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(12);
	});

	it("reports non-numbers and out-of-range values", async () => {
		const { user } = renderField(<NumberField label="Quantity" />, {
			defaultValue: undefined,
			schema: numberRange({ min: 1, max: 10 }),
		});
		const input = screen.getByLabelText("Quantity");
		await user.type(input, "abc");
		await user.tab();
		expectInvalid(input, "Enter a number.");
		await user.clear(input);
		await user.type(input, "11");
		expectInvalid(input, "Must be at most 10.");
	});

	it("uses the numeric keypad for whole numbers", () => {
		renderField(<NumberField label="Age" integer />, {
			defaultValue: undefined,
			schema: numberRange({ integer: true }),
		});
		expect(screen.getByLabelText("Age")).toHaveAttribute("inputmode", "numeric");
	});
});

describe("CurrencyField", () => {
	it("shows the NPR prefix and reformats with grouping on blur", async () => {
		const { user, submit, onSubmit } = renderField(<CurrencyField label="Price" />, {
			defaultValue: undefined,
			schema: currency(),
		});
		expect(screen.getByText("NPR")).toBeInTheDocument();
		const input = screen.getByLabelText("Price");
		await user.type(input, "1234.5");
		await user.tab();
		expect(input).toHaveValue("1,234.50");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(1234.5);
	});

	it("rejects more than two decimals and negative amounts", async () => {
		const { user } = renderField(<CurrencyField label="Price" />, { defaultValue: undefined, schema: currency() });
		const input = screen.getByLabelText("Price");
		await user.type(input, "1.234");
		await user.tab();
		expectInvalid(input, "Use at most 2 decimal places.");
		await user.clear(input);
		await user.type(input, "-5");
		await user.tab();
		expectInvalid(input, "Must be at least 0.");
	});

	it("shows an existing value formatted", () => {
		renderField(<CurrencyField label="Price" currency="USD" />, { defaultValue: 99, schema: currency() });
		expect(screen.getByLabelText("Price")).toHaveValue("99.00");
		expect(screen.getByText("$")).toBeInTheDocument();
	});
});
