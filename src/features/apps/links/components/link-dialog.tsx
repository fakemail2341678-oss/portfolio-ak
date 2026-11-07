import { formOptions } from "@tanstack/react-form";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { dayRangeInZone, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import { isoDate } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { LINK_TITLE_MAX, linkSlug, linkTarget, SLUG_MAX, TARGET_MAX } from "../schema";
import type { LinkItem } from "../types";

const linkFormSchema = (today: string) =>
	z.object({
		target: linkTarget(),
		slug: z.union([z.literal(""), linkSlug()]),
		title: z.string().trim().max(LINK_TITLE_MAX),
		expiresOn: z.union([z.literal(""), isoDate({ min: today })]),
	});
type LinkFormValues = z.input<ReturnType<typeof linkFormSchema>>;

/** The last day a link works -> the instant it stops: the start of the next day in the app's time zone. */
export const expiryInstant = (day: string): string | null =>
	dayRangeInZone(day, day, APP_TIME_ZONE).end?.toISOString() ?? null;

/** The instant a link stops -> the last day it works, in the app's time zone. */
export const expiryDay = (instant: string | null): string =>
	instant ? todayInZone(APP_TIME_ZONE, new Date(new Date(instant).getTime() - 1)) : "";

export type LinkDialogValues = { target: string; slug: string; title: string; expiresAt: string | null };

/**
 * Creating or editing a short link (decision 0191): where it goes, its slug (on
 * create only: a printed or shared link must never change), a title and the last day
 * it works. `onSubmit` resolves once saved or rejects (the form shows why, a taken
 * slug on its field). Loaded on click (decision 0168).
 */
export default function LinkDialog({
	link,
	onSubmit,
	onClose,
}: {
	link?: LinkItem;
	onSubmit: (values: LinkDialogValues) => Promise<unknown>;
	onClose: () => void;
}) {
	const today = todayInZone(APP_TIME_ZONE);
	const schema = linkFormSchema(today);
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				target: link?.target ?? "",
				slug: link?.slug ?? "",
				title: link?.title ?? "",
				expiresOn: expiryDay(link?.expiresAt ?? null),
			} as LinkFormValues,
			validators: formValidators(schema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const parsed = schema.parse(value);
				await onSubmit({
					target: parsed.target,
					slug: parsed.slug,
					title: parsed.title,
					expiresAt: parsed.expiresOn ? expiryInstant(parsed.expiresOn) : null,
				});
				formApi.reset(value);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={link ? m.links_edit() : m.links_new()}
				description={link ? undefined : m.links_new_description()}
				submitLabel={link ? m.crud_save() : m.crud_create()}
				onClose={onClose}
				data-testid="links-dialog"
			>
				<form.AppField name="target">
					{(field) => (
						<field.UrlField
							label={m.links_field_target()}
							placeholder="https://"
							maxLength={TARGET_MAX}
							autoComplete="off"
						/>
					)}
				</form.AppField>
				{link ? null : (
					<form.AppField name="slug">
						{(field) => (
							<field.TextField
								label={m.links_field_slug()}
								description={m.links_field_slug_hint()}
								optional
								maxLength={SLUG_MAX}
								autoComplete="off"
							/>
						)}
					</form.AppField>
				)}
				<form.AppField name="title">
					{(field) => <field.TextField label={m.links_field_title()} optional maxLength={LINK_TITLE_MAX} />}
				</form.AppField>
				<form.AppField name="expiresOn">
					{(field) => (
						<field.DateField
							label={m.links_field_expires()}
							description={m.links_field_expires_hint()}
							optional
							min={today}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
