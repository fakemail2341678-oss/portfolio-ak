import { formOptions } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { CrudForm, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm, withForm } from "@/components/forms";
import { SlugField, slugValidators } from "@/components/forms/fields/slug-field";
import { StickyFormBar } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { ImageGalleryField } from "@/features/attachments/components/image-gallery-field";
import { TEST_CRUD_MAX_IMAGES } from "@/features/attachments/constants";
import { isTestCrudSlugFree } from "@/functions/test-crud";
import { m } from "@/paraglide/messages";
import { testCrudKeys } from "../keys";
import { STATUS_LABELS } from "../labels";
import { testCrudMutations } from "../queries";
import {
	TEST_CRUD_STATUSES,
	type TestCrudDetail,
	type TestCrudFormValues,
	testCrudFormSchema,
	toTestCrudInput,
} from "../schema";

/** The form's values for an item (or a new one) and its validation: shared by the form and its sections. */
export const testCrudFormOptions = (item?: TestCrudDetail) =>
	formOptions({
		defaultValues: {
			title: item?.title ?? "",
			slug: item?.slug ?? "",
			summary: item?.summary ?? "",
			body: item?.body ?? "",
			status: item?.status ?? "draft",
			price: item?.price ?? 0,
			phone: item?.phone ?? "",
			tags: item?.tags ?? [],
			images: (item?.images ?? []).map((preview) => ({ id: preview.id, alt: preview.alt, preview })),
		} as TestCrudFormValues,
		validators: formValidators(testCrudFormSchema),
	});

/** Status, price, contact and tags: a section of the form in its own component (withForm keeps its fields typed). */
const DetailsSection = withForm({
	...testCrudFormOptions(),
	render: function DetailsSection({ form }) {
		const statusOptions = TEST_CRUD_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status]() }));
		return (
			<>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="status">
						{(field) => <field.RadioGroupField label={m.test_crud_field_status()} options={statusOptions} />}
					</form.AppField>
					<form.AppField name="price">
						{(field) => <field.CurrencyField label={m.test_crud_field_price()} />}
					</form.AppField>
				</div>
				<form.AppField name="phone">
					{(field) => <field.PhoneField label={m.test_crud_field_phone()} optional />}
				</form.AppField>
				<form.AppField name="tags">
					{(field) => <field.TagsInputField label={m.test_crud_field_tags()} optional />}
				</form.AppField>
			</>
		);
	},
});

/**
 * Create and edit form, built only from the reusable fields; useCrudForm does
 * the rest (docs/guides/crud.md). The same Zod schema validates here and on the
 * server; server-only failures (slug taken, image rejected) come back on their
 * fields, and a stale save offers a reload. Render it with key={crudFormKey(item)}.
 */
export function TestCrudForm({
	item,
	onSaved,
	onCancel,
	className,
}: {
	item?: TestCrudDetail;
	/** After a successful save (default: go to the list). The edit dialog closes itself instead. */
	onSaved?: () => unknown;
	/** Replaces the "Back to the list" link with a button (the edit dialog's close). */
	onCancel?: () => void;
	className?: string;
}) {
	const navigate = useNavigate();
	/** Image uploads in progress (submitting waits for them). */
	const uploading = useRef(false);
	const crud = useCrudForm({
		item,
		toInput: toTestCrudInput,
		create: testCrudMutations.create(),
		update: testCrudMutations.update(),
		invalidate: [testCrudKeys.all],
		reload: item && testCrudKeys.detail(item.id),
		onSaved: onSaved ?? (() => navigate({ to: "/admin/test-crud" })),
	});
	const form = useAppForm({ ...testCrudFormOptions(item), ...crud.formProps });

	return (
		<CrudForm form={form} crud={crud} className={className} data-testid="test-crud-form">
			<form.AppField name="title">
				{(field) => <field.TextField label={m.test_crud_field_title()} maxLength={120} />}
			</form.AppField>
			{/* New items: the slug follows the title until the user edits it; a taken slug shows as you type. */}
			<form.AppField
				name="slug"
				validators={slugValidators({
					from: "title",
					isAvailable: (slug) => isTestCrudSlugFree({ data: { slug, ...(item ? { id: item.id } : {}) } }),
				})}
			>
				{() => (
					<SlugField
						label={m.test_crud_field_slug()}
						description={m.test_crud_field_slug_description()}
						from="title"
						fromLabel={m.test_crud_field_title()}
						linked={!item}
					/>
				)}
			</form.AppField>
			<form.AppField name="summary">
				{(field) => (
					<field.TextareaField label={m.test_crud_field_summary()} optional rows={3} maxLength={280} showCount />
				)}
			</form.AppField>
			<form.AppField name="body">
				{(field) => <field.RichTextField label={m.test_crud_field_body()} optional />}
			</form.AppField>
			<DetailsSection form={form} />
			<form.AppField
				name="images"
				validators={{ onSubmit: () => (uploading.current ? m.attachments_field_wait() : undefined) }}
			>
				{() => (
					<ImageGalleryField
						label={m.test_crud_field_image()}
						scope="test-crud"
						max={TEST_CRUD_MAX_IMAGES}
						onBusyChange={(busy) => {
							uploading.current = busy;
						}}
					/>
				)}
			</form.AppField>
			<StickyFormBar
				submitLabel={item ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				cancel={
					onCancel ? (
						<Button type="button" variant="ghost" onClick={onCancel}>
							{m.common_cancel()}
						</Button>
					) : (
						<Button variant="ghost" asChild>
							<Link to="/admin/test-crud">{m.crud_back()}</Link>
						</Button>
					)
				}
			/>
		</CrudForm>
	);
}
