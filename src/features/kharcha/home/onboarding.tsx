import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { CURRENCIES, currencyLabel } from "@/lib/i18n/currency";
import { m } from "@/paraglide/messages";
import { KharchaMark } from "../kit/wordmark";
import { kharchaMutations } from "../queries";
import { timeZone } from "../schema";
import { KHARCHA_STARTS, type KharchaMe } from "../types";

const onboardingForm = z.object({ homeCurrency: z.enum(CURRENCIES), timeZone, start: z.enum(KHARCHA_STARTS) });
type OnboardingValues = z.infer<typeof onboardingForm>;

/** The zones this runtime knows, with the given ones first. */
const zones = (...first: string[]): string[] => {
	const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
	return [...new Set([...first, ...all])];
};

/**
 * Onboarding on the first visit (PLAN 14.5, decision 0282): the home currency, the time zone
 * (the device's, once the page runs in the browser) and what they came for, which decides
 * what Home shows first. A card at the top of Home, not a dialog: the page stays usable
 * and the first thing the keyboard reaches is still the skip link. Skipping keeps what is
 * set; either way it is done and never shows again.
 */
export function OnboardingCard({ me, userId }: { me: KharchaMe; userId: string }) {
	const queryClient = useQueryClient();
	const onboard = useMutation(kharchaMutations.onboard(queryClient, userId));
	const currencies = me.currencies.includes(me.profile.homeCurrency)
		? me.currencies
		: [me.profile.homeCurrency, ...me.currencies];
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				homeCurrency: me.profile.homeCurrency as OnboardingValues["homeCurrency"],
				timeZone: me.profile.timeZone,
				start: me.profile.start,
			},
			validators: formValidators(onboardingForm),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await onboard.mutateAsync(value);
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	// The device's zone is known only in the browser: suggest it until they pick one themselves.
	useEffect(() => {
		const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (device && !form.getFieldMeta("timeZone")?.isTouched) form.setFieldValue("timeZone", device);
	}, [form]);
	const skip = () => {
		const { homeCurrency, timeZone: zone, start } = me.profile;
		onboard
			.mutateAsync({ homeCurrency: homeCurrency as OnboardingValues["homeCurrency"], timeZone: zone, start })
			.catch(() => toast.error(m.kharcha_onboarding_failed()));
	};
	return (
		<section
			aria-labelledby="kharcha-onboarding-title"
			className="overflow-hidden rounded-lg border border-kh-hair bg-kh-page"
			data-testid="kharcha-onboarding"
		>
			<div className="flex items-center gap-3 border-kh-hair border-b px-4 py-4 sm:px-5">
				<KharchaMark className="shrink-0" />
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 id="kharcha-onboarding-title" className="kh-display text-kh-head">
						{m.kharcha_onboarding_title()}
					</h2>
					<p className="text-kh-muted text-sm">{m.kharcha_onboarding_description()}</p>
				</div>
			</div>
			<form.AppForm>
				<form.Form className="flex flex-col">
					<div className="grid gap-6 px-4 py-5 sm:px-5 md:grid-cols-2">
						<div className="empty:hidden md:col-span-2">
							<form.FormErrorSummary />
						</div>
						<div className="md:col-span-2">
							<form.AppField name="start">
								{(field) => (
									<field.RadioGroupField
										label={m.kharcha_onboarding_start()}
										options={[
											{
												value: "track",
												label: m.kharcha_onboarding_track(),
												description: m.kharcha_onboarding_track_body(),
											},
											{
												value: "split",
												label: m.kharcha_onboarding_split(),
												description: m.kharcha_onboarding_split_body(),
											},
										]}
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
									description={m.kharcha_onboarding_time_zone_help()}
									options={zones(field.state.value, me.profile.timeZone).map((zone) => ({
										value: zone,
										label: zone.replaceAll("_", " "),
									}))}
								/>
							)}
						</form.AppField>
					</div>
					<div className="flex justify-end gap-2 border-kh-hair border-t px-4 py-3 sm:px-5">
						<Button
							type="button"
							variant="ghost"
							onClick={skip}
							disabled={onboard.isPending}
							data-testid="kharcha-onboarding-skip"
						>
							{m.kharcha_onboarding_skip()}
						</Button>
						<form.SubmitButton>{m.kharcha_onboarding_submit()}</form.SubmitButton>
					</div>
				</form.Form>
			</form.AppForm>
		</section>
	);
}
