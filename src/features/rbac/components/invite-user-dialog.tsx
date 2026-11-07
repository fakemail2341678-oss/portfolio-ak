import { formOptions } from "@tanstack/react-form";
import { useCrudForm } from "@/components/crud/use-crud-form";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, useAppForm } from "@/components/forms";
import { availabilityValidators } from "@/components/forms/async-validators";
import { isUserEmailFree } from "@/functions/rbac";
import { email } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { getLocale, type Locale } from "@/paraglide/runtime";
import { userKeys } from "../keys";
import { userMutations } from "../queries";
import { type UserInviteValues, userInviteSchema } from "../schema";

const LANGUAGE_LABELS: Record<Locale, () => string> = { en: m.language_en, ne: m.language_ne };

const inviteFormOptions = () =>
	formOptions({
		defaultValues: { name: "", email: "", locale: getLocale() } as UserInviteValues,
		validators: formValidators(userInviteSchema),
	});

const emailSchema = email();

/**
 * Invite someone by email (decisions.md 0133). Their account is created at once
 * (the baseline role); the email, in the language picked here, links to choosing
 * a password. Roles are given afterwards, from the list. A taken address shows
 * while typing (and the save refuses it again).
 */
export function InviteUserDialog({ onClose }: { onClose: () => void }) {
	const crud = useCrudForm({
		toInput: (values: UserInviteValues) => userInviteSchema.parse(values),
		create: userMutations.invite(),
		invalidate: [userKeys.all],
		onSaved: onClose,
		messages: { created: (input) => m.users_toast_invited({ email: input.email }) },
	});
	const form = useAppForm({ ...inviteFormOptions(), ...crud.formProps });
	return (
		<form.AppForm>
			<FormDialog
				title={m.users_invite_title()}
				description={m.users_invite_description()}
				submitLabel={m.users_invite_send()}
				onClose={onClose}
				data-testid="invite-user-dialog"
			>
				<form.AppField name="name">
					{(field) => <field.TextField label={m.users_invite_name()} maxLength={80} autoComplete="off" />}
				</form.AppField>
				<form.AppField
					name="email"
					validators={availabilityValidators({
						isAvailable: (value) => isUserEmailFree({ data: { email: value.trim() } }),
						accepts: (value) => emailSchema.safeParse(value).success,
						message: m.users_invite_email_taken,
					})}
				>
					{(field) => <field.EmailField label={m.users_invite_email()} autoComplete="off" />}
				</form.AppField>
				<form.AppField name="locale">
					{(field) => (
						<field.SelectField
							label={m.users_invite_language()}
							options={(Object.keys(LANGUAGE_LABELS) as Locale[]).map((locale) => ({
								value: locale,
								label: LANGUAGE_LABELS[locale](),
							}))}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
