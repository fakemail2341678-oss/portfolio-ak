import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { CURRENCIES, currencyLabel } from "@/lib/i18n/currency";
import { email, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { kharchaMutations } from "../queries";
import { NAME_MAX } from "../schema";
import { GROUP_KINDS, type GroupKind, type KharchaMe } from "../types";
import type { CreateAction } from "./actions";

/** A group's kind in words (the new-group dialog; Task 90's group settings use them too). */
export const GROUP_KIND_LABELS: Record<GroupKind, () => string> = {
	trip: () => m.kharcha_group_kind_trip(),
	home: () => m.kharcha_group_kind_home(),
	couple: () => m.kharcha_group_kind_couple(),
	event: () => m.kharcha_group_kind_event(),
	other: () => m.kharcha_group_kind_other(),
};

/**
 * The + menu's dialogs (loaded with the first one opened). Each saves through its server
 * function, which refuses with a reason in words (a guest adding an address, a quota), and
 * then the caller's pages refetch. Task 90 adds invites, members and the pages they open.
 */
export default function CreateDialog({
	action,
	me,
	userId,
	onClose,
}: {
	action: CreateAction;
	me: KharchaMe;
	userId: string;
	onClose: () => void;
}) {
	return action === "friend" ? (
		<AddFriendDialog me={me} userId={userId} onClose={onClose} />
	) : (
		<NewGroupDialog me={me} userId={userId} onClose={onClose} />
	);
}

const friendSchema = z.object({
	name: required({ max: NAME_MAX }),
	email: z.union([z.literal(""), email()]),
});

function AddFriendDialog({ me, userId, onClose }: { me: KharchaMe; userId: string; onClose: () => void }) {
	const queryClient = useQueryClient();
	const add = useMutation(kharchaMutations.addFriend(queryClient, userId));
	const form = useAppForm({
		...formOptions({ defaultValues: { name: "", email: "" }, validators: formValidators(friendSchema) }),
		onSubmit: async ({ value, formApi }) => {
			try {
				const friend = await add.mutateAsync({
					name: value.name.trim(),
					...(value.email.trim() ? { email: value.email.trim() } : {}),
				});
				toast.success(m.kharcha_friend_added({ name: friend.person.name }));
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_create_friend()}
				description={me.isGuest ? m.kharcha_friend_guest_description() : m.kharcha_friend_description()}
				submitLabel={m.kharcha_friend_submit()}
				onClose={onClose}
				data-testid="kharcha-friend-dialog"
			>
				<form.AppField name="name">
					{(field) => <field.TextField label={m.kharcha_field_name()} maxLength={NAME_MAX} autoComplete="off" />}
				</form.AppField>
				{me.isGuest ? null : (
					<form.AppField name="email">
						{(field) => (
							<field.EmailField
								label={m.kharcha_field_email()}
								description={m.kharcha_friend_email_help()}
								optional
								autoComplete="off"
							/>
						)}
					</form.AppField>
				)}
			</FormDialog>
		</form.AppForm>
	);
}

const groupSchema = z.object({
	name: required({ max: NAME_MAX }),
	kind: z.enum(GROUP_KINDS),
	currency: z.enum(CURRENCIES),
});

function NewGroupDialog({ me, userId, onClose }: { me: KharchaMe; userId: string; onClose: () => void }) {
	const queryClient = useQueryClient();
	const create = useMutation(kharchaMutations.createGroup(queryClient, userId));
	const currencies = me.currencies.includes(me.profile.homeCurrency)
		? me.currencies
		: [me.profile.homeCurrency, ...me.currencies];
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: "",
				kind: "trip" as GroupKind,
				currency: me.profile.homeCurrency as (typeof CURRENCIES)[number],
			},
			validators: formValidators(groupSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const group = await create.mutateAsync({
					name: value.name.trim(),
					kind: value.kind,
					color: "teal",
					currency: value.currency,
					startOn: null,
					endOn: null,
					memberIds: [],
				});
				toast.success(m.kharcha_group_created({ name: group.name }));
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_create_group()}
				description={m.kharcha_group_description()}
				submitLabel={m.kharcha_group_submit()}
				onClose={onClose}
				data-testid="kharcha-group-dialog"
			>
				<form.AppField name="name">
					{(field) => <field.TextField label={m.kharcha_field_group_name()} maxLength={NAME_MAX} autoComplete="off" />}
				</form.AppField>
				<form.AppField name="kind">
					{(field) => (
						<field.SelectField
							label={m.kharcha_field_group_kind()}
							options={GROUP_KINDS.map((kind) => ({ value: kind, label: GROUP_KIND_LABELS[kind]() }))}
						/>
					)}
				</form.AppField>
				<form.AppField name="currency">
					{(field) => (
						<field.SelectField
							label={m.kharcha_field_currency()}
							options={currencies.map((code) => ({ value: code, label: currencyLabel(code) }))}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
