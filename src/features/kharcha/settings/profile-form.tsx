import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { CURRENCIES, type CurrencyCode, currencyLabel } from "@/lib/i18n/currency";
import { optionalText } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { zones } from "../home/onboarding";
import { kharchaMeQueryOptions, kharchaMutations } from "../queries";
import { PAY_NOTE_MAX, timeZone } from "../schema";
import { useKharchaUserId } from "../shell/actions";

const profileForm = z.object({
	homeCurrency: z.enum(CURRENCIES),
	timeZone,
	payNote: optionalText({ max: PAY_NOTE_MAX }),
});

/**
 * Settings → Profile (Task 91): the home currency, the time zone ("today" and month edges),
 * and the pay note: how friends can pay the caller, shown to them when they settle up and
 * in the caller's reminders.
 */
export function ProfileForm() {
	const userId = useKharchaUserId();
	const queryClient = useQueryClient();
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const save = useMutation(kharchaMutations.updateProfile(queryClient, userId));
	const currencies = me.currencies.includes(me.profile.homeCurrency)
		? me.currencies
		: [me.profile.homeCurrency, ...me.currencies];
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				homeCurrency: me.profile.homeCurrency as CurrencyCode,
				timeZone: me.profile.timeZone,
				payNote: me.profile.payNote,
			},
			validators: formValidators(profileForm),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await save.mutateAsync({ ...value, payNote: value.payNote.trim() });
				toast.success(m.kharcha_profile_saved());
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<section
			aria-labelledby="kharcha-profile-title"
			className="overflow-hidden rounded-lg border border-kh-hair bg-kh-page"
			data-testid="kharcha-profile"
		>
			<h2 id="kharcha-profile-title" className="sr-only">
				{m.kharcha_settings_profile()}
			</h2>
			<form.AppForm>
				<form.Form className="flex flex-col">
					<div className="grid gap-6 px-4 py-5 sm:px-5 md:grid-cols-2">
						<div className="empty:hidden md:col-span-2">
							<form.FormErrorSummary />
						</div>
						<div className="md:col-span-2">
							<form.AppField name="payNote">
								{(field) => (
									<field.TextareaField
										label={m.kharcha_profile_pay_note()}
										description={m.kharcha_profile_pay_note_help()}
										optional
										maxLength={PAY_NOTE_MAX}
										rows={2}
									/>
								)}
							</form.AppField>
						</div>
						<form.AppField name="homeCurrency">
							{(field) => (
								<field.SelectField
									label={m.kharcha_onboarding_currency()}
									description={m.kharcha_onboarding_currency_help()}
									options={currencies.map((code) => ({ value: code, label: currencyLabel(code) }))}
								/>
							)}
						</form.AppField>
						<form.AppField name="timeZone">
							{(field) => (
								<field.ComboboxField
									label={m.kharcha_onboarding_time_zone()}
									description={m.kharcha_profile_time_zone_help()}
									options={zones(field.state.value, me.profile.timeZone).map((zone) => ({
										value: zone,
										label: zone.replaceAll("_", " "),
									}))}
								/>
							)}
						</form.AppField>
					</div>
					<div className="flex justify-end gap-2 border-kh-hair border-t px-4 py-3 sm:px-5">
						<form.SubmitButton>{m.kharcha_profile_save()}</form.SubmitButton>
					</div>
				</form.Form>
			</form.AppForm>
		</section>
	);
}
