// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OtpField, PhoneField } from "@/components/forms/fields/phone-otp-fields";
import { phone } from "@/lib/phone";
import { otp } from "@/lib/validation";
import { expectInvalid, expectValid, renderField } from "./harness";

describe("PhoneField", () => {
	it("defaults to Nepal (+977) and stores E.164", async () => {
		const { user, submit, onSubmit } = renderField(<PhoneField label="Phone" />, {
			defaultValue: "",
			schema: phone(),
		});
		expect(screen.getByRole("combobox", { name: /Country code: Nepal \+977/ })).toBeInTheDocument();
		const input = screen.getByLabelText("Phone");
		expect(input).toHaveAttribute("type", "tel");
		expect(input).toHaveAttribute("autocomplete", "tel-national");
		await user.type(input, "981-234 5678");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("+9779812345678");
	});

	it("accepts Devanagari digits and formats the number on blur", async () => {
		const { user, submit, onSubmit } = renderField(<PhoneField label="Phone" />, {
			defaultValue: "",
			schema: phone(),
		});
		const input = screen.getByLabelText("Phone");
		await user.type(input, "९८१२३४५६७८");
		await user.tab();
		expect(input).not.toHaveValue("९८१२३४५६७८");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("+9779812345678");
	});

	it("switches country with the searchable picker", async () => {
		const { user, submit, onSubmit } = renderField(<PhoneField label="Phone" />, {
			defaultValue: "",
			schema: phone(),
		});
		await user.click(screen.getByRole("combobox", { name: /Country code/ }));
		await user.type(screen.getByRole("combobox", { name: /Search/ }), "India");
		await user.click(await screen.findByRole("option", { name: "India (+91)" }));
		expect(screen.getByRole("combobox", { name: /Country code: India \+91/ })).toBeInTheDocument();
		await user.type(screen.getByLabelText("Phone"), "9876543210");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("+919876543210");
	});

	it("shows existing E.164 values in national format with their country", () => {
		renderField(<PhoneField label="Phone" />, { defaultValue: "+447400123456", schema: phone() });
		expect(screen.getByRole("combobox", { name: /United Kingdom \+44/ })).toBeInTheDocument();
		expect(screen.getByLabelText("Phone")).toHaveValue("07400 123456");
	});

	it("reports invalid numbers", async () => {
		const { user, submit, onSubmit } = renderField(<PhoneField label="Phone" />, {
			defaultValue: "",
			schema: phone(),
		});
		const input = screen.getByLabelText("Phone");
		expectValid(input);
		await user.type(input, "123");
		await submit();
		expect(onSubmit).not.toHaveBeenCalled();
		expectInvalid(input, "Enter a valid phone number.");
	});
});

describe("OtpField", () => {
	it("is a labelled one-time-code input that accepts six digits", async () => {
		const { user, submit, onSubmit } = renderField(<OtpField label="Code" />, { defaultValue: "", schema: otp() });
		const input = screen.getByLabelText("Code");
		expect(input).toHaveAttribute("autocomplete", "one-time-code");
		expect(input).toHaveAttribute("inputmode", "numeric");
		expect(input).toHaveAttribute("maxlength", "6");
		await user.click(input);
		await user.keyboard("12a34b56");
		expect(input).toHaveValue("123456");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("123456");
	});

	it("fills every slot from a pasted code", async () => {
		const { user, submit, onSubmit } = renderField(<OtpField label="Code" />, { defaultValue: "", schema: otp() });
		await user.click(screen.getByLabelText("Code"));
		await user.paste("654321");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("654321");
	});

	it("reports an incomplete code", async () => {
		const { user, submit } = renderField(<OtpField label="Code" />, { defaultValue: "", schema: otp() });
		await user.click(screen.getByLabelText("Code"));
		await user.keyboard("123");
		await submit();
		expectInvalid(screen.getByLabelText("Code"), "Enter the 6-digit code.");
	});
});
