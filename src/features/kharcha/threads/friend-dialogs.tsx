import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CopyButton } from "@/components/data-display/copy-button";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDayMonth } from "@/lib/i18n/intl";
import { email, optionalText } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { kharchaMutations } from "../queries";
import { NAME_MAX } from "../schema";
import type { FriendView, InviteResult } from "../types";

export type FriendDialogKind = "nickname" | "email" | "invite";

/**
 * A friend's dialogs (Task 90, loaded with the first one opened): the caller's own name
 * for them, an address for a contact added by name (it merges into whoever has it), and an
 * invite: a link to copy, emailed when asked.
 */
export default function FriendDialog({
	kind,
	friend,
	userId,
	onClose,
}: {
	kind: FriendDialogKind;
	friend: FriendView;
	userId: string;
	onClose: () => void;
}) {
	if (kind === "nickname") return <NicknameDialog friend={friend} userId={userId} onClose={onClose} />;
	if (kind === "email") return <EmailDialog friend={friend} userId={userId} onClose={onClose} />;
	return (
		<InviteDialog
			personId={friend.person.id}
			name={friend.person.name}
			groupId={null}
			userId={userId}
			onClose={onClose}
		/>
	);
}

const nicknameSchema = z.object({ nickname: optionalText({ max: NAME_MAX }) });

function NicknameDialog({ friend, userId, onClose }: { friend: FriendView; userId: string; onClose: () => void }) {
	const queryClient = useQueryClient();
	const update = useMutation(kharchaMutations.updateFriend(queryClient, userId));
	const form = useAppForm({
		...formOptions({ defaultValues: { nickname: friend.nickname }, validators: formValidators(nicknameSchema) }),
		onSubmit: async ({ value, formApi }) => {
			try {
				await update.mutateAsync({ personId: friend.person.id, nickname: value.nickname.trim() });
				toast.success(m.kharcha_friend_renamed());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_friend_rename()}
				description={m.kharcha_friend_rename_description()}
				submitLabel={m.kharcha_save()}
				onClose={onClose}
				data-testid="kharcha-nickname-dialog"
			>
				<form.AppField name="nickname">
					{(field) => (
						<field.TextField
							label={m.kharcha_field_nickname()}
							description={m.kharcha_field_nickname_help()}
							optional
							maxLength={NAME_MAX}
							autoComplete="off"
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

const emailSchema = z.object({ email: email(), invite: z.boolean() });

function EmailDialog({ friend, userId, onClose }: { friend: FriendView; userId: string; onClose: () => void }) {
	const queryClient = useQueryClient();
	const save = useMutation(kharchaMutations.setFriendEmail(queryClient, userId));
	const form = useAppForm({
		...formOptions({ defaultValues: { email: "", invite: true }, validators: formValidators(emailSchema) }),
		onSubmit: async ({ value, formApi }) => {
			try {
				await save.mutateAsync({ personId: friend.person.id, email: value.email.trim(), invite: value.invite });
				toast.success(value.invite ? m.kharcha_friend_email_invited() : m.kharcha_friend_email_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_friend_add_email()}
				description={m.kharcha_friend_email_description({ name: friend.person.name })}
				submitLabel={m.kharcha_save()}
				onClose={onClose}
				data-testid="kharcha-email-dialog"
			>
				<form.AppField name="email">
					{(field) => <field.EmailField label={m.kharcha_field_email()} autoComplete="off" />}
				</form.AppField>
				<form.AppField name="invite">
					{(field) => (
						<field.CheckboxField label={m.kharcha_invite_send()} description={m.kharcha_invite_send_help()} />
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

/**
 * An invite for someone without an account: a link to copy, and an email when asked (at
 * most one a day to the same address; the link works either way). From a group's members,
 * `groupId` puts its name on the page the link opens.
 */
export function InviteDialog({
	personId,
	name,
	groupId,
	userId,
	onClose,
}: {
	personId: string;
	name: string;
	groupId: string | null;
	userId: string;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const invite = useMutation(kharchaMutations.invite(queryClient, userId));
	const [result, setResult] = useState<InviteResult | null>(null);
	const linkId = useId();
	const form = useAppForm({
		...formOptions({ defaultValues: { send: true } }),
		onSubmit: async ({ value, formApi }) => {
			try {
				setResult(await invite.mutateAsync({ personId, groupId, send: value.send }));
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	if (result) {
		return (
			<Dialog open onOpenChange={(open) => !open && onClose()}>
				<DialogContent className="sm:max-w-lg" data-testid="kharcha-invite-link">
					<DialogHeader>
						<DialogTitle>{m.kharcha_invite_ready({ name })}</DialogTitle>
						<DialogDescription>
							{result.sent
								? m.kharcha_invite_sent({ date: formatDayMonth(result.expiresAt.slice(0, 10)) })
								: m.kharcha_invite_copy({ date: formatDayMonth(result.expiresAt.slice(0, 10)) })}
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2">
						<label htmlFor={linkId} className="sr-only">
							{m.kharcha_invite_link()}
						</label>
						<Input id={linkId} readOnly value={result.url} onFocus={(event) => event.currentTarget.select()} />
						<CopyButton value={result.url} label={m.kharcha_invite_copy_link()} />
					</div>
					<DialogFooter>
						<Button onClick={onClose}>{m.kharcha_done()}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_invite_title({ name })}
				description={m.kharcha_invite_description()}
				submitLabel={m.kharcha_invite_submit()}
				onClose={onClose}
				data-testid="kharcha-invite-dialog"
			>
				<form.AppField name="send">
					{(field) => (
						<field.CheckboxField label={m.kharcha_invite_send()} description={m.kharcha_invite_send_help()} />
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
