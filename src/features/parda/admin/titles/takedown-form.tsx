import { formOptions } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { CrudForm, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
import { StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { pardaAdminKeys } from "../keys";
import { MEDIA_LABELS } from "../labels";
import { pardaAdminMutations } from "../queries";
import { PARDA_MEDIA, type TakedownFormValues, takedownInput } from "../schema";

const takedownFormOptions = () =>
	formOptions({
		// The id starts empty, not 0: the admin types it.
		defaultValues: { media: "movie", tmdbId: undefined, reason: "" } as unknown as TakedownFormValues,
		validators: formValidators(takedownInput),
	});

/**
 * /admin/parda/titles/new: block a title by TMDB's type and id (the number in its Parda
 * or TMDB address). Blocking one twice is refused on the id.
 */
export function PardaTakedownNewPage() {
	const navigate = useNavigate();
	const crud = useCrudForm({
		toInput: (values: TakedownFormValues) => takedownInput.parse(values),
		create: pardaAdminMutations.blockTitle(),
		invalidate: [pardaAdminKeys.takedowns()],
		onSaved: () => navigate({ to: "/admin/parda/titles" }),
		messages: { created: () => m.pd_admin_takedown_created() },
	});
	const form = useAppForm({ ...takedownFormOptions(), ...crud.formProps });
	return (
		<Page width="admin">
			<PageHeader title={m.pd_admin_takedown_new_title()} description={m.pd_admin_takedown_new_description()} />
			<CrudForm form={form} crud={crud} data-testid="parda-takedown-form">
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="media">
						{(field) => (
							<field.RadioGroupField
								label={m.pd_admin_takedown_media()}
								options={PARDA_MEDIA.map((media) => ({ value: media, label: MEDIA_LABELS[media]() }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="tmdbId">
						{(field) => (
							<field.NumberField integer label={m.pd_admin_takedown_id()} description={m.pd_admin_takedown_id_hint()} />
						)}
					</form.AppField>
				</div>
				<form.AppField name="reason">
					{(field) => (
						<field.TextareaField
							label={m.pd_admin_takedown_reason()}
							description={m.pd_admin_takedown_reason_hint()}
							rows={3}
							maxLength={500}
							showCount
						/>
					)}
				</form.AppField>
				<StickyFormBar
					submitLabel={m.pd_admin_takedown_submit()}
					pendingLabel={m.crud_saving()}
					cancel={
						<Button variant="ghost" asChild>
							<Link to="/admin/parda/titles">{m.crud_back()}</Link>
						</Button>
					}
				/>
			</CrudForm>
		</Page>
	);
}
