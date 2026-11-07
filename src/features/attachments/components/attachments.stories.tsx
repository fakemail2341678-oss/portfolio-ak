import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { z } from "zod";
import { FieldStory } from "@/components/forms/story-harness";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { sampleAdmin, sampleImageAsset } from "../../../../.storybook/mocks/data";
import { CloudImage } from "./cloud-image";
import type { FieldImage } from "./image-gallery-field";
import { ImageGalleryField } from "./image-gallery-field";

const image = (n: number, en = ""): FieldImage => {
	const id = `6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0${String(n).padStart(3, "0")}`;
	const alt = { en, ne: "" };
	return { id, alt, preview: { ...sampleImageAsset, id, alt } };
};

function Editor({ initial }: { initial: FieldImage[] }) {
	return (
		<FieldStory schema={z.array(z.custom<FieldImage>())} defaultValue={initial} onSubmit={fn()}>
			<ImageGalleryField label={m.test_crud_field_image()} scope="test-crud" max={8} />
		</FieldStory>
	);
}

const meta = {
	title: "Forms/Images (attachments)",
	component: Editor,
	args: { initial: [image(1, "A plate of momo"), image(2)] },
	// Signed in with attachments:upload; uploads go to the mocked server functions.
	parameters: { app: { session: sampleAdmin } },
} satisfies Meta<typeof Editor>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Ordered images: the first is the cover; each has alt text, a drag handle (Alt + ↑/↓ moves it too) and remove. */
export const WithImages: Story = {
	play: async ({ canvas, userEvent }) => {
		await expect(canvas.getByText(m.attachments_field_cover())).toBeVisible();
		canvas
			.getByRole("button", { name: m.sortable_handle({ item: m.attachments_field_image_n({ n: formatNumber(2) }) }) })
			.focus();
		await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
		await expect(
			canvas.getByRole("textbox", {
				name: m.attachments_field_alt_in({ n: formatNumber(2), language: m.language_en() }),
			}),
		).toHaveValue("A plate of momo");
		await expect(await canvas.findByRole("button", { name: m.attachments_field_add() })).toBeEnabled();
	},
};

export const Empty: Story = { args: { initial: [] } };

/** Without attachments:upload: images stay editable, nothing can be added. */
export const WithoutUploadPermission: Story = {
	parameters: { app: { session: { ...sampleAdmin, permissions: ["test-crud:update"] } } },
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("button", { name: m.attachments_field_add() })).toBeNull();
	},
};

/** The three delivery variants (server-built URLs in the app; a local file here). */
export const Variants: Story = {
	render: () => (
		<div className="flex flex-wrap items-start gap-4">
			<div className="relative aspect-[16/9] w-80 overflow-hidden rounded-lg border bg-muted">
				<CloudImage
					image={sampleImageAsset}
					variant="cover"
					sizes="320px"
					className="absolute inset-0 size-full object-cover"
				/>
			</div>
			<CloudImage image={sampleImageAsset} variant="full" sizes="240px" className="h-auto w-60 rounded-lg border" />
			<CloudImage image={sampleImageAsset} variant="thumb" className="size-20 rounded border object-cover" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const images = within(canvasElement).getAllByRole("img");
		await expect(images).toHaveLength(3);
		for (const img of images) await expect(img).toHaveAttribute("width");
	},
};
