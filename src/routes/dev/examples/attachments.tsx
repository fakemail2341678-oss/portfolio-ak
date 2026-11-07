import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { formValidators, useAppForm } from "@/components/forms";
import { type FieldImage, ImageGalleryField } from "@/features/attachments/components/image-gallery-field";
import { attachmentRefSchema } from "@/features/attachments/schema";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { Can } from "@/features/rbac/can";
import { staticCrumb } from "@/lib/breadcrumbs";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

const MAX_IMAGES = 4;

/**
 * Attachments: <ImageGalleryField> inside a form. Files go straight from the
 * browser to Cloudinary with a server signature, are verified by the server and
 * recorded as pending uploads; a feature's save links them (here the form only
 * shows what it would send: ids and alt text). Unlinked uploads are deleted by
 * the cleanup job after a day. Needs Cloudinary settings and `attachments:upload`.
 */
export const Route = createFileRoute("/dev/examples/attachments")({
	staticData: { breadcrumb: staticCrumb(m.examples_attachments_title) },
	head: () => privateHead(m.examples_attachments_title()),
	component: AttachmentsExample,
});

const formSchema = z.object({
	images: z.array(attachmentRefSchema.extend({ preview: z.custom<FieldImage["preview"]>() })).max(MAX_IMAGES),
});

function AttachmentsExample() {
	const [sent, setSent] = useState<string | null>(null);
	const uploading = useRef(false);
	const form = useAppForm({
		defaultValues: { images: [] as FieldImage[] },
		validators: formValidators(formSchema),
		onSubmit: ({ value }) => {
			setSent(
				JSON.stringify(
					value.images.map(({ id, alt }) => ({ id, alt })),
					null,
					2,
				),
			);
		},
	});
	return (
		<ExamplePage slug="attachments">
			<Demo title={m.examples_attachments_demo()} note={m.examples_attachments_note()}>
				<Can
					permission="attachments:upload"
					fallback={<p className="text-sm">{m.examples_attachments_no_permission()}</p>}
				>
					<form.AppForm>
						<form.Form className="flex flex-col gap-4" data-testid="attachments-form">
							<form.FormErrorSummary />
							<form.AppField
								name="images"
								// Never submit while uploads are still running.
								validators={{ onSubmit: () => (uploading.current ? m.attachments_field_wait() : undefined) }}
							>
								{() => (
									<ImageGalleryField
										label={m.examples_attachments_label()}
										scope="examples"
										max={MAX_IMAGES}
										onBusyChange={(busy) => {
											uploading.current = busy;
										}}
									/>
								)}
							</form.AppField>
							<form.SubmitButton>{m.examples_attachments_submit()}</form.SubmitButton>
						</form.Form>
					</form.AppForm>
					{sent ? (
						<pre
							className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs"
							data-testid="attachments-sent"
						>
							{sent}
						</pre>
					) : null}
				</Can>
			</Demo>
		</ExamplePage>
	);
}
