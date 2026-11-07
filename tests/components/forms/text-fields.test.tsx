// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailField, PasswordField, TextareaField, TextField, UrlField } from "@/components/forms/fields/text-fields";
import { email, optionalText, password, required, url } from "@/lib/validation";
import { expectInvalid, expectValid, renderField } from "./harness";

describe("TextField", () => {
	it("renders a labelled input with its description", () => {
		renderField(<TextField label="Full name" description="As on your ID." />, { defaultValue: "", schema: required() });
		const input = screen.getByLabelText("Full name");
		expect(input).toHaveAttribute("type", "text");
		expect(input.getAttribute("aria-describedby")).toContain("-description");
		expect(screen.getByText("As on your ID.")).toBeInTheDocument();
		expectValid(input);
	});

	it("updates the value and submits it", async () => {
		const { user, submit, onSubmit } = renderField(<TextField label="Full name" />, {
			defaultValue: "",
			schema: required(),
		});
		await user.type(screen.getByLabelText("Full name"), "Sita");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("Sita");
	});

	it("shows a localized error after blur and marks the input invalid", async () => {
		const { user } = renderField(<TextField label="Full name" />, { defaultValue: "", schema: required() });
		const input = screen.getByLabelText("Full name");
		await user.click(input);
		await user.tab();
		expect(await screen.findByText("This field is required.")).toBeInTheDocument();
		expectInvalid(input, "This field is required.");
	});

	it("marks optional fields in the label", () => {
		renderField(<TextField label="Nickname" optional />, { defaultValue: "", schema: optionalText() });
		expect(screen.getByLabelText("Nickname (optional)")).toBeInTheDocument();
	});
});

describe("TextareaField", () => {
	it("renders, counts characters and enforces the maximum", async () => {
		const { user } = renderField(<TextareaField label="Bio" maxLength={10} showCount />, {
			defaultValue: "",
			schema: optionalText({ max: 5 }),
		});
		const textarea = screen.getByLabelText("Bio");
		expect(textarea.tagName).toBe("TEXTAREA");
		await user.type(textarea, "abcdefg");
		expect(screen.getByText("7 of 10 characters")).toBeInTheDocument();
		await user.tab();
		expectInvalid(textarea, "Use at most 5 characters.");
	});
});

describe("EmailField", () => {
	it("uses the email input type and autocomplete", () => {
		renderField(<EmailField label="Email" />, { defaultValue: "", schema: email() });
		const input = screen.getByLabelText("Email");
		expect(input).toHaveAttribute("type", "email");
		expect(input).toHaveAttribute("autocomplete", "email");
	});

	it("rejects an invalid address and accepts a valid one", async () => {
		const { user, submit, onSubmit } = renderField(<EmailField label="Email" />, { defaultValue: "", schema: email() });
		const input = screen.getByLabelText("Email");
		await user.type(input, "sita@");
		await user.tab();
		expectInvalid(input, "Enter a valid email address.");
		await user.type(input, "example.com");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("sita@example.com");
		expectValid(input);
	});
});

describe("PasswordField", () => {
	it("toggles visibility with an accessible, pressed-state button", async () => {
		const { user } = renderField(<PasswordField label="Password" />, { defaultValue: "", schema: required() });
		const input = screen.getByLabelText("Password");
		expect(input).toHaveAttribute("type", "password");
		const toggle = screen.getByRole("button", { name: "Show password" });
		expect(toggle).toHaveAttribute("aria-pressed", "false");
		await user.click(toggle);
		expect(input).toHaveAttribute("type", "text");
		expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
	});

	it("reports strength and rejects weak passwords", async () => {
		const { user, submit, onSubmit } = renderField(
			<PasswordField label="New password" autoComplete="new-password" showStrength />,
			{ defaultValue: "", schema: password() },
		);
		const input = screen.getByLabelText("New password");
		await user.type(input, "abcdefgh");
		expect(screen.getByText("Password strength: weak")).toBeInTheDocument();
		await user.tab();
		expectInvalid(input, "Make it stronger");
		await user.clear(input);
		await user.type(input, "Correct-Horse-9");
		expect(screen.getByText("Password strength: very strong")).toBeInTheDocument();
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("Correct-Horse-9");
	});
});

describe("UrlField", () => {
	it("uses the url input type and validates http(s) addresses", async () => {
		const { user, submit, onSubmit } = renderField(<UrlField label="Website" />, { defaultValue: "", schema: url() });
		const input = screen.getByLabelText("Website");
		expect(input).toHaveAttribute("type", "url");
		await user.type(input, "ftp://example.com");
		await user.tab();
		expectInvalid(input, "Enter a valid web address");
		await user.clear(input);
		await user.type(input, "https://example.com");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("https://example.com");
	});
});
