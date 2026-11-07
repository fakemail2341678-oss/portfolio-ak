// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ColorField, SliderField, TagsInputField } from "@/components/forms/fields/misc-fields";
import { hexColor, numberRange, tags } from "@/lib/validation";
import { expectInvalid, renderField } from "./harness";

describe("SliderField", () => {
	it("is a labelled slider with a readable value, moved by keyboard", async () => {
		const { user, submit, onSubmit } = renderField(<SliderField label="Volume" min={0} max={10} />, {
			defaultValue: 5,
			schema: numberRange({ min: 0, max: 10 }),
		});
		const slider = screen.getByRole("slider", { name: "Volume" });
		expect(slider).toHaveAttribute("aria-valuenow", "5");
		expect(slider).toHaveAttribute("aria-valuetext", "Value: 5");
		slider.focus();
		await user.keyboard("{ArrowRight}{ArrowRight}");
		expect(slider).toHaveAttribute("aria-valuenow", "7");
		await user.keyboard("{End}");
		expect(slider).toHaveAttribute("aria-valuetext", "Value: 10");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(10);
	});

	it("uses a custom value format", () => {
		renderField(<SliderField label="Opacity" formatValue={(value) => `${value}%`} />, {
			defaultValue: 40,
			schema: numberRange(),
		});
		expect(screen.getByRole("slider", { name: "Opacity" })).toHaveAttribute("aria-valuetext", "Value: 40%");
	});

	it("reports values the schema rejects", async () => {
		const { submit } = renderField(<SliderField label="Volume" />, {
			defaultValue: 5,
			schema: numberRange({ min: 10 }),
		});
		await submit();
		expectInvalid(screen.getByRole("slider", { name: "Volume" }), "Must be at least 10.");
	});
});

describe("TagsInputField", () => {
	it("adds tags with Enter, comma and paste; ignores duplicates", async () => {
		const { user, submit, onSubmit } = renderField(<TagsInputField label="Tags" />, {
			defaultValue: [],
			schema: tags(),
		});
		const input = screen.getByLabelText("Tags");
		await user.type(input, "react{Enter}");
		await user.type(input, "vite,");
		await user.paste("one, two , REACT");
		expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["react", "vite", "one", "two"]);
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(["react", "vite", "one", "two"]);
	});

	it("removes tags with their button or Backspace", async () => {
		const { user, submit, onSubmit } = renderField(<TagsInputField label="Tags" />, {
			defaultValue: ["a", "b", "c"],
			schema: tags(),
		});
		await user.click(screen.getByRole("button", { name: "Remove tag b" }));
		await user.click(screen.getByLabelText("Tags"));
		await user.keyboard("{Backspace}");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith(["a"]);
	});

	it("adds the pending text on blur and reports the limit", async () => {
		const { user, submit } = renderField(<TagsInputField label="Tags" />, {
			defaultValue: ["a"],
			schema: tags({ max: 1 }),
		});
		await user.type(screen.getByLabelText("Tags"), "b");
		await user.tab();
		await submit();
		expectInvalid(screen.getByLabelText("Tags"), "Add at most 1 tags.");
	});
});

describe("ColorField", () => {
	it("keeps the picker and the hex text in sync", async () => {
		const { user, submit, onSubmit } = renderField(<ColorField label="Brand" />, {
			defaultValue: "#2563eb",
			schema: hexColor(),
		});
		const text = screen.getByLabelText("Brand");
		const picker = screen.getByLabelText("Color picker");
		expect(picker).toHaveValue("#2563eb");
		await user.clear(text);
		await user.type(text, "FF0000");
		expect(text).toHaveValue("#FF0000");
		expect(picker).toHaveValue("#ff0000");
		fireEvent.input(picker, { target: { value: "#00ff00" } });
		expect(text).toHaveValue("#00ff00");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("#00ff00");
	});

	it("reports an invalid hex colour", async () => {
		const { user, submit } = renderField(<ColorField label="Brand" />, {
			defaultValue: "",
			schema: z.string().pipe(hexColor()),
		});
		await user.type(screen.getByLabelText("Brand"), "#12");
		await submit();
		expectInvalid(screen.getByLabelText("Brand"), "Enter a color like #1e40af.");
	});
});
