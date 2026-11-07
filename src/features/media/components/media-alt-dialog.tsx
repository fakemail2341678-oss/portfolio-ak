import { formOptions } from "@tanstack/react-form";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { m } from "@/paraglide/messages";
import { mediaKeys, mediaMutations } from "../queries";
import { type MediaItemDto, mediaAltSchema } from "../schema";
import { MediaThumb } from "./media-tile";

/** Alt text of one item, in both languages, in a dialog. */
export function AltDialog({ item, onClose }: { item: MediaItemDto; onClose: () => void }) {
	const save = useCrudMutation(mediaMutations.setAlt(), { invalidate: [mediaKeys.all] });
	const form = useAppForm({
		...formOptions({ defaultValues: { id: item.id, alt: item.image.alt }, validators: formValidators(mediaAltSchema) }),
		onSubmit: async ({ value, formApi }) => {
			try {
				await save.mutateAsync(mediaAltSchema.parse(value));
				toast.success(m.crud_toast_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.media_alt_title()}
				description={m.media_alt_description()}
				submitLabel={m.crud_save()}
				pendingLabel={m.crud_saving()}
				onClose={onClose}
				data-testid="alt-dialog"
			>
				<MediaThumb image={item.image} className="size-32" />
				<LocalizedField form={form} fields="alt" label={m.media_alt_label()} optional multiline maxLength={200} />
			</FormDialog>
		</form.AppForm>
	);
}
