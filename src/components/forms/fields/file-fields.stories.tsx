import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { files } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { FieldStory } from "../story-harness";
import { FileField, ImageField } from "./file-fields";

const meta = { title: "Forms/File and image", component: FileField } satisfies Meta<typeof FileField>;
export default meta;
type Story = StoryObj<typeof meta>;

const MB = 1024 * 1024;
const fileRules = { maxBytes: 5 * MB, accept: ["application/pdf", "image/*"] };
const imageRules = { maxBytes: 2 * MB, accept: ["image/png", "image/jpeg", "image/webp"] };
const args = { label: "", ...fileRules };

export const File: Story = {
	args,
	render: () => (
		<FieldStory schema={files({ ...fileRules, max: 3 })} defaultValue={[]}>
			<FileField label={m.showcase_attachments()} optional multiple {...fileRules} />
		</FieldStory>
	),
};

export const Image: Story = {
	args,
	render: () => (
		<FieldStory schema={files(imageRules)} defaultValue={[]}>
			<ImageField label={m.showcase_avatar()} maxBytes={imageRules.maxBytes} />
		</FieldStory>
	),
};

function WithStoredImage() {
	const [removed, setRemoved] = useState(false);
	return (
		<ImageField
			label={m.showcase_avatar()}
			maxBytes={imageRules.maxBytes}
			current={{ url: "/favicon.svg", removed, onRemove: () => setRemoved(true), onKeep: () => setRemoved(false) }}
		/>
	);
}

/** Edit forms: the stored image with Remove / Keep until a new one is picked. */
export const ImageWithCurrent: Story = {
	args,
	render: () => (
		<FieldStory schema={files(imageRules)} defaultValue={[]}>
			<WithStoredImage />
		</FieldStory>
	),
};
