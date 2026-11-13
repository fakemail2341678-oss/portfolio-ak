import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { NOTIFY_EMAILS, NOTIFY_KINDS, type NotifyEmail, type NotifyKind } from "../notifications";
import { kharchaMeQueryOptions, kharchaMutations } from "../queries";
import { useKharchaUserId } from "../shell/actions";

export const NOTIFY_KIND_LABELS: Record<NotifyKind, () => string> = {
	"group.added": () => m.kharcha_notify_kind_group_added(),
	"expense.added": () => m.kharcha_notify_kind_expense_added(),
	"expense.updated": () => m.kharcha_notify_kind_expense_updated(),
	"expense.deleted": () => m.kharcha_notify_kind_expense_deleted(),
	"payment.received": () => m.kharcha_notify_kind_payment(),
	"comment.mention": () => m.kharcha_notify_kind_mention(),
	"comment.thread": () => m.kharcha_notify_kind_comment(),
	reminder: () => m.kharcha_notify_kind_reminder(),
};

const NOTIFY_EMAIL_LABELS: Record<NotifyEmail, () => string> = {
	instant: () => m.kharcha_notify_mode_instant(),
	digest: () => m.kharcha_notify_mode_digest(),
	none: () => m.kharcha_notify_mode_none(),
};

const notifyForm = z.object(
	Object.fromEntries(NOTIFY_KINDS.map((kind) => [kind, z.enum(NOTIFY_EMAILS)])) as Record<
		NotifyKind,
		z.ZodEnum<{ [K in NotifyEmail]: K }>
	>,
);

/**
 * Settings → Notifications (Task 92): how each kind is emailed: at once, in the daily
 * digest (07:15 in Kathmandu), or not at all. Everything shows on Home either way. A
 * guest's emails go nowhere, so the form says so.
 */
export function NotifyForm() {
	const userId = useKharchaUserId();
	const queryClient = useQueryClient();
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const save = useMutation(kharchaMutations.notifySettings(queryClient, userId));
	const form = useAppForm({
		...formOptions({ defaultValues: me.profile.notify, validators: formValidators(notifyForm) }),
		onSubmit: async ({ value, formApi }) => {
			try {
				await save.mutateAsync({ notify: value });
				toast.success(m.kharcha_notify_saved());
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<section
			aria-labelledby="kharcha-notify-title"
			className="overflow-hidden rounded-lg border border-kh-hair bg-kh-page"
			data-testid="kharcha-notify"
		>
			<div className="flex flex-col gap-1 border-kh-hair border-b px-4 py-4 sm:px-5">
				<h2 id="kharcha-notify-title" className="font-semibold text-sm">
					{m.kharcha_settings_notifications()}
				</h2>
				<p className="text-caption text-kh-muted">
					{me.isGuest ? m.kharcha_notify_help_guest() : m.kharcha_notify_help()}
				</p>
			</div>
			<form.AppForm>
				<form.Form className="flex flex-col">
					<div className="grid gap-x-6 gap-y-5 px-4 py-5 sm:px-5 md:grid-cols-2">
						<div className="empty:hidden md:col-span-2">
							<form.FormErrorSummary />
						</div>
						{NOTIFY_KINDS.map((kind) => (
							<form.AppField key={kind} name={kind}>
								{(field) => (
									<field.SelectField
										label={NOTIFY_KIND_LABELS[kind]()}
										options={NOTIFY_EMAILS.map((mode) => ({ value: mode, label: NOTIFY_EMAIL_LABELS[mode]() }))}
									/>
								)}
							</form.AppField>
						))}
					</div>
					<div className="flex justify-end gap-2 border-kh-hair border-t px-4 py-3 sm:px-5">
						<form.SubmitButton>{m.kharcha_notify_save()}</form.SubmitButton>
					</div>
				</form.Form>
			</form.AppForm>
		</section>
	);
}
