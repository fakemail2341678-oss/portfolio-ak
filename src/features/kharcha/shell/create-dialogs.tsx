import { formOptions, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import type { ImageAsset } from "@/features/attachments/schema";
import { CURRENCIES, currencyLabel } from "@/lib/i18n/currency";
import { email, isoDate, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { ReceiptsField } from "../expenses/receipts-field";
import { GROUP_KIND_LABELS } from "../groups/labels";
import { GroupIconPicker } from "../groups/pickers";
import { kharchaLinks } from "../links";
import { kharchaFriendsQueryOptions, kharchaMutations } from "../queries";
import { NAME_MAX } from "../schema";
import { ColorPicker } from "../settings/pickers";
import {
	GROUP_ICONS,
	GROUP_KIND_ICON,
	GROUP_KINDS,
	type GroupIcon,
	type GroupKind,
	KHARCHA_COLORS,
	type KharchaColor,
	type KharchaMe,
} from "../types";
import type { CreateAction } from "./actions";

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
	action: Exclude<CreateAction, "expense" | "split" | "settle">;
	me: KharchaMe;
	userId: string;
	onClose: () => void;
}) {
	if (action === "receipt") return <AddReceiptDialog me={me} userId={userId} onClose={onClose} />;
	return action === "friend" ? (
		<AddFriendDialog me={me} userId={userId} onClose={onClose} />
	) : (
		<NewGroupDialog me={me} userId={userId} onClose={onClose} />
	);
}

/**
 * "Add a receipt" (Task 89): upload now, add the details later. The receipts wait as a
 * draft, listed on Home, until an expense is made from them.
 */
function AddReceiptDialog({ me, userId, onClose }: { me: KharchaMe; userId: string; onClose: () => void }) {
	const queryClient = useQueryClient();
	const save = useMutation(kharchaMutations.createDraft(queryClient, userId));
	const form = useAppForm({
		...formOptions({ defaultValues: { receipts: [] as ImageAsset[] } }),
		onSubmit: async ({ value, formApi }) => {
			if (busy.current) {
				toast.error(m.kharcha_receipts_wait());
				return;
			}
			if (value.receipts.length === 0) {
				toast.error(m.kharcha_receipt_draft_empty());
				return;
			}
			try {
				await save.mutateAsync(value.receipts.map((receipt) => receipt.id));
				toast.success(m.kharcha_receipt_draft_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const busy = useRef(false);
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_create_receipt()}
				description={m.kharcha_receipt_draft_description()}
				submitLabel={m.kharcha_receipt_draft_submit()}
				onClose={onClose}
				data-testid="kharcha-receipt-dialog"
			>
				<form.AppField name="receipts">
					{(field) => (
						<ReceiptsField
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBusyChange={(value) => {
								busy.current = value;
							}}
							max={me.receiptsMax}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

const friendSchema = z.object({
	name: required({ max: NAME_MAX }),
	email: z.union([z.literal(""), email()]),
	invite: z.boolean(),
});

/**
 * Add a friend: by name, or with their address too (never a guest's). With an address,
 * "Email them an invite" sends one at once when they have no account yet.
 */
function AddFriendDialog({ me, userId, onClose }: { me: KharchaMe; userId: string; onClose: () => void }) {
	const queryClient = useQueryClient();
	const add = useMutation(kharchaMutations.addFriend(queryClient, userId));
	const form = useAppForm({
		...formOptions({
			defaultValues: { name: "", email: "", invite: true },
			validators: formValidators(friendSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const address = value.email.trim();
				const friend = await add.mutateAsync({
					name: value.name.trim(),
					...(address ? { email: address, invite: value.invite } : {}),
				});
				toast.success(
					address && value.invite && !friend.person.hasAccount
						? m.kharcha_friend_added_invited({ name: friend.person.name })
						: m.kharcha_friend_added({ name: friend.person.name }),
				);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const address = useStore(form.store, (state) => state.values.email.trim());
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
				{me.isGuest || !address ? null : (
					<form.AppField name="invite">
						{(field) => (
							<field.CheckboxField label={m.kharcha_invite_send()} description={m.kharcha_invite_send_help()} />
						)}
					</form.AppField>
				)}
			</FormDialog>
		</form.AppForm>
	);
}

const groupSchema = z
	.object({
		name: required({ max: NAME_MAX }),
		kind: z.enum(GROUP_KINDS),
		currency: z.enum(CURRENCIES),
		color: z.enum(KHARCHA_COLORS),
		icon: z.enum(GROUP_ICONS),
		startOn: z.union([z.literal(""), isoDate()]),
		endOn: z.union([z.literal(""), isoDate()]),
		memberIds: z.array(z.string()),
	})
	.refine((value) => !value.startOn || !value.endOn || value.startOn <= value.endOn, {
		path: ["endOn"],
		error: () => m.kharcha_group_dates_order(),
	});

/**
 * A new group (Task 90): its name, kind, colour and icon, currency, a trip's dates, and
 * friends to add at once. The kind's own icon is picked until the caller picks another.
 */
function NewGroupDialog({ me, userId, onClose }: { me: KharchaMe; userId: string; onClose: () => void }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const create = useMutation(kharchaMutations.createGroup(queryClient, userId));
	const { data: friends = [] } = useQuery(kharchaFriendsQueryOptions(userId));
	const iconChosen = useRef(false);
	const currencies = me.currencies.includes(me.profile.homeCurrency)
		? me.currencies
		: [me.profile.homeCurrency, ...me.currencies];
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: "",
				kind: "trip" as GroupKind,
				currency: me.profile.homeCurrency as (typeof CURRENCIES)[number],
				color: "teal" as KharchaColor,
				icon: GROUP_KIND_ICON.trip as GroupIcon,
				startOn: "",
				endOn: "",
				memberIds: [] as string[],
			},
			validators: formValidators(groupSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const trip = value.kind === "trip";
				const group = await create.mutateAsync({
					name: value.name.trim(),
					kind: value.kind,
					color: value.color,
					icon: value.icon,
					currency: value.currency,
					startOn: trip && value.startOn ? value.startOn : null,
					endOn: trip && value.endOn ? value.endOn : null,
					memberIds: value.memberIds,
				});
				toast.success(m.kharcha_group_created({ name: group.name }));
				onClose();
				void navigate(kharchaLinks.group(group.id));
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const kind = useStore(form.store, (state) => state.values.kind);
	const color = useStore(form.store, (state) => state.values.color);
	const icon = useStore(form.store, (state) => state.values.icon);
	const choosable = friends.filter((friend) => !friend.hidden);
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_create_group()}
				description={m.kharcha_group_description()}
				submitLabel={m.kharcha_group_submit()}
				onClose={onClose}
				className="sm:max-w-xl max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
				data-testid="kharcha-group-dialog"
			>
				<form.AppField name="name">
					{(field) => <field.TextField label={m.kharcha_field_group_name()} maxLength={NAME_MAX} autoComplete="off" />}
				</form.AppField>
				<div className="grid gap-4 sm:grid-cols-2">
					<form.AppField
						name="kind"
						listeners={{
							onChange: ({ value }) => {
								if (!iconChosen.current) form.setFieldValue("icon", GROUP_KIND_ICON[value]);
							},
						}}
					>
						{(field) => (
							<field.SelectField
								label={m.kharcha_field_group_kind()}
								options={GROUP_KINDS.map((each) => ({ value: each, label: GROUP_KIND_LABELS[each]() }))}
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
				</div>
				{kind === "trip" ? (
					<div className="grid gap-4 sm:grid-cols-2">
						<form.AppField name="startOn">
							{(field) => <field.DateField label={m.kharcha_field_start_on()} optional />}
						</form.AppField>
						<form.AppField name="endOn">
							{(field) => <field.DateField label={m.kharcha_field_end_on()} optional />}
						</form.AppField>
					</div>
				) : null}
				<ColorPicker name="kharcha-group-color" value={color} onChange={(next) => form.setFieldValue("color", next)} />
				<GroupIconPicker
					name="kharcha-group-icon"
					value={icon}
					color={color}
					onChange={(next) => {
						iconChosen.current = true;
						form.setFieldValue("icon", next);
					}}
				/>
				{choosable.length > 0 ? (
					<form.AppField name="memberIds">
						{(field) => (
							<field.CheckboxGroupField
								label={m.kharcha_group_add_friends()}
								optional
								options={choosable.map((friend) => ({ value: friend.person.id, label: friend.person.name }))}
							/>
						)}
					</form.AppField>
				) : null}
			</FormDialog>
		</form.AppForm>
	);
}
