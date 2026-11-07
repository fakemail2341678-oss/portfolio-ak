// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useAppForm } from "@/components/forms";
import { normalizeLinkHref } from "@/components/forms/fields/rich-text-editor";
import { RichTextField } from "@/components/forms/fields/rich-text-field";
import { richText } from "@/lib/validation";
import { expectInvalid, renderField } from "./harness";

function ServerForm() {
	const form = useAppForm({ defaultValues: { body: "<p>Hi</p>" } });
	return (
		<form.AppForm>
			<form.Form>
				<form.AppField name="body">{(field) => <field.RichTextField label="Body" />}</form.AppField>
			</form.Form>
		</form.AppForm>
	);
}

const findEditor = () => screen.findByRole("textbox", { name: "Body" }, { timeout: 5000 });

describe("RichTextField", () => {
	it("renders a same-sized placeholder on the server, never the editor", () => {
		const html = renderToString(<ServerForm />);
		expect(html).toContain('data-testid="rich-text-placeholder"');
		expect(html).toContain("Loading editor…");
		expect(html).toContain("min-h-40");
		expect(html).toContain("h-10");
		expect(html).not.toContain("contenteditable");
		expect(html).not.toContain("ProseMirror");
	});

	it("mounts the editor in the browser with the stored HTML and an accessible name", async () => {
		const { submit, onSubmit } = renderField(<RichTextField label="Body" />, {
			defaultValue: "<p>Hello <strong>world</strong></p>",
			schema: richText(),
		});
		const editor = await findEditor();
		expect(editor).toHaveAttribute("contenteditable", "true");
		expect(editor).toHaveAttribute("aria-multiline", "true");
		expect(editor.innerHTML).toContain("<strong>world</strong>");
		expect(screen.queryByTestId("rich-text-placeholder")).not.toBeInTheDocument();
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("<p>Hello <strong>world</strong></p>");
	});

	it("has a labelled toolbar with one tab stop and arrow-key navigation", async () => {
		const { user } = renderField(<RichTextField label="Body" />, { defaultValue: "", schema: richText() });
		await findEditor();
		const toolbar = screen.getByRole("toolbar", { name: "Text formatting" });
		const buttons = within(toolbar).getAllByRole("button");
		expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
			"Bold",
			"Italic",
			"Underline",
			"Strikethrough",
			"Heading",
			"Bulleted list",
			"Numbered list",
			"Quote",
			"Link",
			"Undo",
			"Redo",
		]);
		expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
		buttons[0]?.focus();
		await user.keyboard("{ArrowRight}");
		expect(within(toolbar).getByRole("button", { name: "Italic" })).toHaveFocus();
		await user.keyboard("{End}");
		const redo = within(toolbar).getByRole("button", { name: "Redo" });
		expect(redo).toHaveFocus();
		expect(redo).toHaveAttribute("aria-disabled", "true");
		await user.keyboard("{ArrowRight}");
		expect(within(toolbar).getByRole("button", { name: "Bold" })).toHaveFocus();
	});

	it("toggle buttons report their state with aria-pressed", async () => {
		const { user } = renderField(<RichTextField label="Body" />, { defaultValue: "<p>Hi</p>", schema: richText() });
		await findEditor();
		const bold = screen.getByRole("button", { name: "Bold" });
		expect(bold).toHaveAttribute("aria-pressed", "false");
		await user.click(bold);
		expect(bold).toHaveAttribute("aria-pressed", "true");
	});

	it("opens a link form from the toolbar", async () => {
		const { user } = renderField(<RichTextField label="Body" />, { defaultValue: "<p>Hi</p>", schema: richText() });
		await findEditor();
		await user.click(screen.getByRole("button", { name: "Link" }));
		expect(await screen.findByRole("textbox", { name: "Link address" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Apply link" })).toBeInTheDocument();
	});

	it("reports empty content as required", async () => {
		const { submit, onSubmit } = renderField(<RichTextField label="Body" />, { defaultValue: "", schema: richText() });
		const editor = await findEditor();
		await submit();
		expect(onSubmit).not.toHaveBeenCalled();
		expectInvalid(editor, "This field is required.");
	});
});

describe("normalizeLinkHref", () => {
	it("allows only http(s) and mailto, adding https:// to bare domains", () => {
		expect(normalizeLinkHref("example.com/a")).toBe("https://example.com/a");
		expect(normalizeLinkHref("https://example.com")).toBe("https://example.com/");
		expect(normalizeLinkHref("mailto:me@example.com")).toBe("mailto:me@example.com");
		expect(normalizeLinkHref("javascript:alert(1)")).toBeUndefined();
		expect(normalizeLinkHref("data:text/html,x")).toBeUndefined();
		expect(normalizeLinkHref("  ")).toBeUndefined();
	});
});
