// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { formValidators, useAppForm } from "@/components/forms";
import { type FieldImage, ImageGalleryField } from "@/features/attachments/components/image-gallery-field";
import type { ImageAsset } from "@/features/attachments/schema";
import { sessionQueryOptions } from "@/features/auth/queries";
import { ALL_PERMISSIONS } from "@/features/rbac/permissions";
import type { Session } from "@/lib/session";

/** Server functions: a ticket, then the verified image (the real ones need the Start runtime). */
const fns = vi.hoisted(() => ({
	getUploadSettings: vi.fn(async () => ({ enabled: true })),
	signImageUpload: vi.fn(async () => ({
		url: "https://api.cloudinary.test/v1_1/demo/image/upload",
		fields: { api_key: "1", timestamp: "1", public_id: "portfolio/test-crud/x", signature: "s" },
		publicId: "portfolio/test-crud/x",
		maxBytes: 10 * 1024 * 1024,
		formats: ["png"],
	})),
	confirmImageUpload: vi.fn(),
	discardImageUpload: vi.fn(async () => {}),
}));
vi.mock("@/functions/attachments", () => fns);

const asset = (id: string, alt = ""): ImageAsset => ({
	id,
	alt: { en: alt, ne: "" },
	format: "png",
	url: `/${id}.png`,
	width: 1600,
	height: 900,
	full: { src: `/${id}.png`, srcSet: `/${id}.png 1600w` },
	cover: { src: `/${id}.png`, srcSet: `/${id}.png 1600w` },
	thumb: `/${id}.png`,
	og: `/${id}.png`,
});

/** A fake XMLHttpRequest: records the request; the test decides when it finishes. */
class FakeXhr {
	static last: FakeXhr | undefined;
	static all: FakeXhr[] = [];
	upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
		onprogress: null,
	};
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onabort: (() => void) | null = null;
	status = 0;
	responseText = "";
	url = "";
	body: FormData | undefined;
	open(_method: string, url: string) {
		this.url = url;
	}
	send(body: FormData) {
		this.body = body;
		FakeXhr.last = this;
		FakeXhr.all.push(this);
	}
	abort() {
		this.onabort?.();
	}
	finish(status = 200, text = "{}") {
		this.status = status;
		this.responseText = text;
		this.onload?.();
	}
}

const ids = [
	"6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0001",
	"6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0002",
	"6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0003",
];

function Harness({ initial, onSubmit }: { initial: FieldImage[]; onSubmit: (value: FieldImage[]) => void }) {
	const form = useAppForm({
		defaultValues: { value: initial },
		validators: formValidators(z.object({ value: z.array(z.custom<FieldImage>()) })),
		onSubmit: ({ value }) => onSubmit(value.value),
	});
	return (
		<form.AppForm>
			<form.Form>
				<form.AppField name="value">
					{() => <ImageGalleryField label="Images" scope="test-crud" max={3} />}
				</form.AppField>
				<form.SubmitButton>Submit</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}

function renderField(initial: FieldImage[], permissions = [...ALL_PERMISSIONS]) {
	const queryClient = new QueryClient();
	const session: Session = {
		user: { id: "u", email: "u@example.com", name: "U", role: "user", twoFactorEnabled: false },
		permissions,
	};
	queryClient.setQueryData(sessionQueryOptions().queryKey, session);
	const onSubmit = vi.fn<(value: FieldImage[]) => void>();
	render(
		<QueryClientProvider client={queryClient}>
			<Harness initial={initial} onSubmit={onSubmit} />
		</QueryClientProvider>,
	);
	return { onSubmit, user: userEvent.setup() };
}

const png = (name = "momo.png") => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });

beforeEach(() => {
	vi.stubGlobal("XMLHttpRequest", FakeXhr);
	FakeXhr.last = undefined;
	FakeXhr.all = [];
	fns.confirmImageUpload.mockImplementation(async () => asset(ids[2] ?? ""));
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("<ImageGalleryField>", () => {
	it("reorders from the keyboard (Alt + Up on the handle), edits alt text, and submits ids in order", async () => {
		const { onSubmit, user } = renderField([
			{ id: ids[0] ?? "", alt: { en: "First", ne: "" }, preview: asset(ids[0] ?? "") },
			{ id: ids[1] ?? "", alt: { en: "", ne: "" }, preview: asset(ids[1] ?? "") },
		]);
		expect(screen.getAllByText("Cover")).toHaveLength(1);
		screen.getByRole("button", { name: "Move Image 2" }).focus();
		await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
		expect(await screen.findByText("Image 2 moved to position 1 of 2.")).toBeInTheDocument();
		await user.type(screen.getByRole("textbox", { name: "Alt text for image 2 in English" }), "!");
		await user.click(screen.getByRole("button", { name: "Submit" }));
		await waitFor(() => expect(onSubmit).toHaveBeenCalled());
		expect(onSubmit.mock.calls[0]?.[0].map((image) => [image.id, image.alt.en])).toEqual([
			[ids[1], ""],
			[ids[0], "First!"],
		]);
	});

	it("uploads straight to Cloudinary with the signed fields, shows progress, then adds the verified image", async () => {
		const { user } = renderField([]);
		const input = document.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("no file input");
		await waitFor(() => expect(screen.getByRole("button", { name: "Add images" })).toBeEnabled());
		await user.upload(input, png());
		await waitFor(() => expect(FakeXhr.last).toBeDefined());
		const xhr = FakeXhr.last as FakeXhr;
		expect(xhr.url).toBe("https://api.cloudinary.test/v1_1/demo/image/upload");
		expect(xhr.body?.get("public_id")).toBe("portfolio/test-crud/x");
		expect(xhr.body?.get("signature")).toBe("s");
		expect(xhr.body?.get("file")).toBeInstanceOf(File);
		act(() => xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 }));
		expect(within(screen.getByTestId("uploads")).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
		act(() => xhr.finish(200));
		await waitFor(() => expect(screen.getByText("Image 1")).toBeInTheDocument());
		expect(fns.confirmImageUpload).toHaveBeenCalledWith({
			data: { scope: "test-crud", publicId: "portfolio/test-crud/x" },
		});
		expect(screen.queryByTestId("uploads")).toBeNull();
	});

	it("several uploads finishing together all end up in the field (regression: the last one won)", async () => {
		let n = 0;
		fns.confirmImageUpload.mockImplementation(async () => asset(ids[n++] ?? ""));
		const { user } = renderField([]);
		const input = document.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("no file input");
		await waitFor(() => expect(screen.getByRole("button", { name: "Add images" })).toBeEnabled());
		await user.upload(input, [png("a.png"), png("b.png")]);
		await waitFor(() => expect(FakeXhr.all).toHaveLength(2));
		act(() => {
			for (const xhr of FakeXhr.all) xhr.finish(200);
		});
		await waitFor(() => expect(screen.getByText("Image 2")).toBeInTheDocument());
	});

	it("removing a fresh upload deletes it at once; cancelling an upload aborts it", async () => {
		const { user } = renderField([]);
		const input = document.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("no file input");
		await waitFor(() => expect(screen.getByRole("button", { name: "Add images" })).toBeEnabled());
		await user.upload(input, png());
		await waitFor(() => expect(FakeXhr.last).toBeDefined());
		act(() => (FakeXhr.last as FakeXhr).finish(200));
		await user.click(await screen.findByRole("button", { name: "Remove image 1" }));
		expect(fns.discardImageUpload).toHaveBeenCalledWith({ data: { id: ids[2] } });

		FakeXhr.last = undefined;
		await user.upload(input, png("second.png"));
		await waitFor(() => expect(FakeXhr.last).toBeDefined());
		await user.click(screen.getByRole("button", { name: "Cancel upload of second.png" }));
		await waitFor(() => expect(screen.queryByTestId("uploads")).toBeNull());
		expect(fns.confirmImageUpload).toHaveBeenCalledTimes(1);
	});

	it("refuses a wrong file type before any request", async () => {
		renderField([]);
		const input = document.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("no file input");
		await waitFor(() => expect(screen.getByRole("button", { name: "Add images" })).toBeEnabled());
		// Bypass the picker's accept filter (a drop or a crafted input can still deliver it).
		await userEvent
			.setup({ applyAccept: false })
			.upload(input, new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
		expect(await screen.findByText(/x\.svg: This file type isn't accepted/)).toBeInTheDocument();
		expect(fns.signImageUpload).not.toHaveBeenCalled();
	});

	it("without attachments:upload: existing images stay editable, nothing can be added", async () => {
		renderField([{ id: ids[0] ?? "", alt: { en: "", ne: "" }, preview: asset(ids[0] ?? "") }], ["test-crud:update"]);
		expect(screen.getByRole("button", { name: "Remove image 1" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Add images" })).toBeNull();
		expect(fns.getUploadSettings).not.toHaveBeenCalled();
	});
});
