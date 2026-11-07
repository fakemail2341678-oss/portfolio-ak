// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FileField, ImageField } from "@/components/forms/fields/file-fields";
import { files } from "@/lib/validation";
import { expectInvalid, expectValid, renderField } from "./harness";

const KB = 1024;
const pdf = (name = "cv.pdf", size = 10) => new File(["x".repeat(size)], name, { type: "application/pdf" });
const png = (name = "me.png", size = 10) => new File(["x".repeat(size)], name, { type: "image/png" });
const rules = { maxBytes: 2 * KB, accept: ["application/pdf", "image/*"] };

/** Dropping bypasses the native accept filter (user.upload honours it), so wrong types reach validation. */
const drop = (files: File[]) => fireEvent.drop(screen.getByTestId("file-dropzone"), { dataTransfer: { files } });

// jsdom has no object URLs; ImageField previews with them.
const createObjectURL = vi.fn((file: Blob) => `blob:test/${(file as File).name}`);
const revokeObjectURL = vi.fn();
beforeAll(() => {
	Object.assign(URL, { createObjectURL, revokeObjectURL });
});
afterAll(() => {
	Reflect.deleteProperty(URL, "createObjectURL");
	Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("FileField", () => {
	it("is a labelled native file input with accept and the limits as a hint", () => {
		renderField(<FileField label="Attachments" multiple {...rules} />, { defaultValue: [], schema: files(rules) });
		const input = screen.getByLabelText("Attachments");
		expect(input).toHaveAttribute("type", "file");
		expect(input).toHaveAttribute("accept", "application/pdf,image/*");
		expect(input).toHaveAttribute("multiple");
		expect(input).toHaveAccessibleDescription("Up to 2 KB each. Accepted: PDF, image/*.");
		expectValid(input);
	});

	it("lists picked files with sizes and removes them", async () => {
		const { user, submit, onSubmit } = renderField(<FileField label="Attachments" multiple {...rules} />, {
			defaultValue: [],
			schema: files({ ...rules, max: 3 }),
		});
		const a = pdf("a.pdf", 1536);
		const b = png("b.png");
		await user.upload(screen.getByLabelText("Attachments"), [a, b]);
		const list = screen.getByTestId("file-list");
		expect(within(list).getByText("a.pdf")).toBeInTheDocument();
		expect(within(list).getByText("1.5 KB")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
		await submit();
		expect(onSubmit).toHaveBeenCalledWith([b]);
	});

	it("accepts files dropped on the drop zone", async () => {
		const { submit, onSubmit } = renderField(<FileField label="Attachments" {...rules} />, {
			defaultValue: [],
			schema: files(rules),
		});
		const zone = screen.getByTestId("file-dropzone");
		const file = pdf();
		fireEvent.dragOver(zone, { dataTransfer: { files: [file] } });
		expect(zone).toHaveAttribute("data-dragging", "true");
		fireEvent.drop(zone, { dataTransfer: { files: [file] } });
		expect(zone).not.toHaveAttribute("data-dragging");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith([file]);
	});

	it("reports oversized and wrongly typed files with their names", async () => {
		renderField(<FileField label="Attachments" multiple {...rules} />, {
			defaultValue: [],
			schema: files({ ...rules, max: 3 }),
		});
		const input = screen.getByLabelText("Attachments");
		const exe = new File(["x"], "run.exe", { type: "application/x-msdownload" });
		drop([pdf("huge.pdf", 3 * KB), exe]);
		await screen.findByText("huge.pdf is larger than 2 KB.");
		expectInvalid(input, "huge.pdf is larger than 2 KB.");
		expectInvalid(input, "run.exe isn't an accepted file type.");
	});

	it("keeps a single file when multiple is off", async () => {
		const { user, submit, onSubmit } = renderField(<FileField label="CV" {...rules} />, {
			defaultValue: [],
			schema: files(rules),
		});
		const second = pdf("second.pdf");
		await user.upload(screen.getByLabelText("CV"), pdf("first.pdf"));
		await user.upload(screen.getByLabelText("CV"), second);
		await submit();
		expect(onSubmit).toHaveBeenCalledWith([second]);
	});
});

describe("ImageField", () => {
	const imageRules = { maxBytes: 2 * KB, accept: ["image/png", "image/jpeg", "image/webp"] };

	it("previews the picked image and revokes the URL when removed", async () => {
		const { user, submit, onSubmit } = renderField(<ImageField label="Photo" maxBytes={2 * KB} />, {
			defaultValue: [],
			schema: files({ ...imageRules, min: 1 }),
		});
		const input = screen.getByLabelText("Photo");
		expect(input).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
		await user.upload(input, png("me.png"));
		expect(screen.getByRole("img", { name: "Preview of me.png" })).toHaveAttribute("src", "blob:test/me.png");
		await user.click(screen.getByRole("button", { name: "Remove me.png" }));
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:test/me.png");
		await submit();
		expect(onSubmit).not.toHaveBeenCalled();
		expectInvalid(input, "Choose a file.");
	});

	it("rejects non-image files", async () => {
		renderField(<ImageField label="Photo" maxBytes={2 * KB} />, {
			defaultValue: [],
			schema: files(imageRules),
		});
		const input = screen.getByLabelText("Photo");
		drop([pdf("doc.pdf")]);
		await screen.findByText("doc.pdf isn't an accepted file type.");
		expectInvalid(input, "doc.pdf isn't an accepted file type.");
	});
});

describe("ImageField with a stored image", () => {
	it("shows the current image until a new one is picked, and lets the form remove or keep it", async () => {
		function WithStoredImage() {
			const [removed, setRemoved] = useState(false);
			return (
				<ImageField
					label="Photo"
					maxBytes={2 * KB}
					current={{
						url: "/api/images/abc",
						removed,
						onRemove: () => setRemoved(true),
						onKeep: () => setRemoved(false),
					}}
				/>
			);
		}
		const { user } = renderField(<WithStoredImage />, {
			defaultValue: [],
			schema: files({ maxBytes: 2 * KB, accept: ["image/png"] }),
		});
		expect(screen.getByRole("img", { name: "Current image" })).toHaveAttribute("src", "/api/images/abc");
		await user.click(screen.getByRole("button", { name: "Remove image" }));
		expect(screen.queryByRole("img", { name: "Current image" })).not.toBeInTheDocument();
		expect(screen.getByText("The current image will be removed when you save.")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Keep image" }));
		expect(screen.getByRole("img", { name: "Current image" })).toBeInTheDocument();
	});

	it("a newly picked image replaces the current preview", async () => {
		const current = { url: "/api/images/abc", removed: false, onRemove: vi.fn(), onKeep: vi.fn() };
		const { user } = renderField(<ImageField label="Photo" maxBytes={2 * KB} current={current} />, {
			defaultValue: [],
			schema: files({ maxBytes: 2 * KB, accept: ["image/png"] }),
		});
		await user.upload(screen.getByLabelText("Photo"), png("new.png"));
		expect(screen.queryByTestId("current-image")).not.toBeInTheDocument();
		expect(screen.getByRole("img", { name: "Preview of new.png" })).toBeInTheDocument();
	});
});
