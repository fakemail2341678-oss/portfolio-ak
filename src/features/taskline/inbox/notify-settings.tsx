import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { MODE_LABELS, NOTIFY_KIND_LABELS, SENT_KINDS } from "../notifications";
import { notifySettingsQueryOptions, tasklineMutations } from "../queries";
import { NOTIFY_MODES, type NotifyKind, type NotifyMode } from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/settings");

/**
 * /app/taskline/settings, "My settings" (Task 50): per kind of notification, an email
 * at once, the daily digest, or nothing; and the language of the emails. A choice
 * equal to the team's default follows the default when the admin changes it.
 */
export function NotifySettingsPage() {
	const { session } = route.useRouteContext();
	return <NotifySettingsView userId={session.user.id} />;
}

/** The page itself (stories render it without the route). */
export function NotifySettingsView({ userId }: { userId: string }) {
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(notifySettingsQueryOptions(userId));
	const save = useMutation(tasklineMutations.saveNotifySettings(queryClient, userId));
	const [modes, setModes] = useState<Partial<Record<NotifyKind, NotifyMode>>>(data.modes);
	const [locale, setLocale] = useState(data.locale);
	const id = useId();
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		save.mutate(
			{ modes, locale },
			{
				onSuccess: () => toast.success(m.crud_toast_saved()),
				onError: (error) => toast.error(errorMessage(error)),
			},
		);
	};
	return (
		<Page width="narrow" data-testid="taskline-settings">
			<PageHeader
				title={m.taskline_my_settings()}
				description={m.taskline_my_settings_description()}
				actions={
					<Button asChild variant="ghost">
						<Link {...tasklineLinks.inbox()}>
							<InboxIcon aria-hidden />
							{m.taskline_inbox()}
						</Link>
					</Button>
				}
			/>
			{data.member ? null : <p className="text-muted-foreground">{m.taskline_notify_no_member()}</p>}
			{data.email ? null : (
				<p className="rounded-md border bg-warning-subtle px-3 py-2 text-body" data-testid="settings-guest">
					{m.taskline_notify_guest()}
				</p>
			)}
			<form method="post" onSubmit={submit} className="flex flex-col gap-6" data-testid="notify-form">
				<fieldset className="flex flex-col gap-3">
					<legend className="mb-1 font-medium text-heading">{m.taskline_notify_heading()}</legend>
					<p className="text-body text-muted-foreground">{m.taskline_notify_explain()}</p>
					<div className="flex flex-col divide-y rounded-lg border">
						{SENT_KINDS.map((kind) => (
							<div key={kind} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
								<label htmlFor={`${id}-${kind}`} className="text-body">
									{NOTIFY_KIND_LABELS[kind]()}
								</label>
								<NativeSelect
									id={`${id}-${kind}`}
									value={modes[kind] ?? data.defaults[kind]}
									onChange={(event) => setModes({ ...modes, [kind]: event.target.value as NotifyMode })}
									className="w-56"
									data-testid={`notify-${kind}`}
								>
									{NOTIFY_MODES.map((mode) => (
										<option key={mode} value={mode}>
											{mode === data.defaults[kind]
												? m.taskline_notify_default({ mode: MODE_LABELS[mode]() })
												: MODE_LABELS[mode]()}
										</option>
									))}
								</NativeSelect>
							</div>
						))}
					</div>
				</fieldset>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-locale`} className="font-medium text-body">
						{m.taskline_notify_locale()}
					</label>
					<NativeSelect
						id={`${id}-locale`}
						value={locale ?? ""}
						onChange={(event) =>
							setLocale(event.target.value === "en" || event.target.value === "ne" ? event.target.value : null)
						}
						className="w-56"
						data-testid="notify-locale"
					>
						<option value="">{m.taskline_notify_locale_unset()}</option>
						<option value="en" lang="en">
							{m.language_en()}
						</option>
						<option value="ne" lang="ne">
							{m.language_ne()}
						</option>
					</NativeSelect>
				</div>
				<div>
					<Button type="submit" disabled={save.isPending} data-testid="notify-save">
						{save.isPending ? m.crud_saving() : m.crud_save()}
					</Button>
				</div>
			</form>
		</Page>
	);
}
