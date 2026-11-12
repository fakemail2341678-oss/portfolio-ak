import { formOptions, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArchiveIcon, ArchiveRestoreIcon, LogOutIcon, SendIcon, UserMinusIcon, UserPlusIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useConfirm } from "@/components/dialogs/confirm";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { errorMessage } from "@/components/errors/error-page";
import { formValidators, handleSaveError, StaleVersionAlert, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { CURRENCIES, type CurrencyCode, currencyLabel } from "@/lib/i18n/currency";
import { email, isoDate, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { PersonAvatar } from "../kit/person-avatar";
import { kharchaLinks } from "../links";
import { SPLIT_METHODS, type SplitMethod } from "../money/split";
import { kharchaFriendsQueryOptions, kharchaMeQueryOptions, kharchaMutations, refreshKharcha } from "../queries";
import { NAME_MAX } from "../schema";
import { ColorPicker } from "../settings/pickers";
import {
	type FriendView,
	GROUP_ICONS,
	GROUP_KINDS,
	type GroupIcon,
	type GroupKind,
	type GroupMemberView,
	type GroupView,
	KHARCHA_COLORS,
	type KharchaColor,
} from "../types";
import { GROUP_KIND_LABELS, SPLIT_METHOD_LABELS } from "./labels";
import { GroupIconPicker } from "./pickers";

const InviteDialog = lazy(() =>
	import("../threads/friend-dialogs").then((module) => ({ default: module.InviteDialog })),
);

/** The methods a group may split by default: "the full amount" is a choice for one expense, not a group. */
const DEFAULT_SPLITS = SPLIT_METHODS.filter((method) => method !== "full");

/**
 * A group's settings tab (Task 90, loaded with it): its details, default split and
 * simplify, saved at the version they were loaded at; its members (add a friend or
 * someone new, invite one without an account, remove one at a zero balance: the owner's);
 * archiving (the owner's) and leaving (at a zero balance). The server refuses with the
 * amounts when someone isn't settled.
 */
export default function GroupSettings({ group, userId }: { group: GroupView; userId: string }) {
	return (
		<div className="flex flex-col gap-8" data-testid="kharcha-group-settings">
			{group.can.edit ? <DetailsForm key={group.version} group={group} userId={userId} /> : null}
			<Members group={group} userId={userId} />
			<Leaving group={group} userId={userId} />
		</div>
	);
}

const detailsSchema = z
	.object({
		name: required({ max: NAME_MAX }),
		kind: z.enum(GROUP_KINDS),
		currency: z.enum(CURRENCIES),
		color: z.enum(KHARCHA_COLORS),
		icon: z.enum(GROUP_ICONS),
		startOn: z.union([z.literal(""), isoDate()]),
		endOn: z.union([z.literal(""), isoDate()]),
		defaultSplit: z.enum(SPLIT_METHODS),
		simplify: z.boolean(),
	})
	.refine((value) => !value.startOn || !value.endOn || value.startOn <= value.endOn, {
		path: ["endOn"],
		error: () => m.kharcha_group_dates_order(),
	});

function DetailsForm({ group, userId }: { group: GroupView; userId: string }) {
	const queryClient = useQueryClient();
	const { data: me } = useQuery(kharchaMeQueryOptions(userId));
	const save = useMutation(kharchaMutations.updateGroup(queryClient, userId));
	const [stale, setStale] = useState(false);
	const currencies = [...new Set([group.currency, ...(me?.currencies ?? [])])].filter((code): code is CurrencyCode =>
		(CURRENCIES as ReadonlyArray<string>).includes(code),
	);
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: group.name,
				kind: group.kind as GroupKind,
				currency: group.currency as CurrencyCode,
				color: group.color as KharchaColor,
				icon: group.icon as GroupIcon,
				startOn: group.startOn ?? "",
				endOn: group.endOn ?? "",
				defaultSplit: group.settings.defaultSplit as SplitMethod,
				simplify: group.settings.simplify,
			},
			validators: formValidators(detailsSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await save.mutateAsync({
					groupId: group.id,
					version: group.version,
					name: value.name.trim(),
					kind: value.kind,
					currency: value.currency,
					color: value.color,
					icon: value.icon,
					startOn: value.startOn || null,
					endOn: value.endOn || null,
					defaultSplit: value.defaultSplit,
					simplify: value.simplify,
				});
				toast.success(m.kharcha_group_saved());
			} catch (error) {
				handleSaveError(formApi, error, () => setStale(true));
			}
		},
	});
	const color = useStore(form.store, (state) => state.values.color);
	const icon = useStore(form.store, (state) => state.values.icon);
	return (
		<section aria-labelledby="kharcha-group-details" className="flex flex-col gap-4">
			<h2 id="kharcha-group-details" className="kh-display text-kh-head">
				{m.kharcha_group_details()}
			</h2>
			{stale ? <StaleVersionAlert onReload={() => refreshKharcha(queryClient, userId)} /> : null}
			<form.AppForm>
				<form.Form className="max-w-2xl rounded-lg border border-kh-hair bg-kh-page p-4 sm:p-6">
					<form.FormErrorSummary />
					<form.AppField name="name">
						{(field) => (
							<field.TextField label={m.kharcha_field_group_name()} maxLength={NAME_MAX} autoComplete="off" />
						)}
					</form.AppField>
					<div className="grid gap-4 sm:grid-cols-2">
						<form.AppField name="kind">
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
									description={m.kharcha_group_currency_help()}
									options={currencies.map((code) => ({ value: code, label: currencyLabel(code) }))}
								/>
							)}
						</form.AppField>
						<form.AppField name="startOn">
							{(field) => <field.DateField label={m.kharcha_field_start_on()} optional />}
						</form.AppField>
						<form.AppField name="endOn">
							{(field) => <field.DateField label={m.kharcha_field_end_on()} optional />}
						</form.AppField>
					</div>
					<ColorPicker
						name="kharcha-group-color"
						value={color}
						onChange={(next) => form.setFieldValue("color", next)}
					/>
					<GroupIconPicker
						name="kharcha-group-icon"
						value={icon}
						color={color}
						onChange={(next) => form.setFieldValue("icon", next)}
					/>
					<form.AppField name="defaultSplit">
						{(field) => (
							<field.SelectField
								label={m.kharcha_field_default_split()}
								description={m.kharcha_field_default_split_help()}
								options={DEFAULT_SPLITS.map((method) => ({ value: method, label: SPLIT_METHOD_LABELS[method]() }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="simplify">
						{(field) => (
							<field.SwitchField label={m.kharcha_field_simplify()} description={m.kharcha_field_simplify_help()} />
						)}
					</form.AppField>
					<div>
						<form.SubmitButton>{m.kharcha_save()}</form.SubmitButton>
					</div>
				</form.Form>
			</form.AppForm>
		</section>
	);
}

type MemberDialog = { kind: "add" } | { kind: "invite"; member: GroupMemberView };

function Members({ group, userId }: { group: GroupView; userId: string }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { data: friends = [] } = useQuery(kharchaFriendsQueryOptions(userId));
	const remove = useMutation(kharchaMutations.removeMember(queryClient, userId));
	const [dialog, setDialog] = useState<MemberDialog | null>(null);
	const current = group.members.filter((member) => member.leftAt === null);
	const former = group.members.filter((member) => member.leftAt !== null);
	const friendOf = (personId: string) => friends.find((friend) => friend.person.id === personId);
	const removeMember = async (member: GroupMemberView) => {
		const ok = await confirm({
			title: m.kharcha_member_remove_title({ name: member.person.name }),
			description: m.kharcha_member_remove_description(),
			confirmLabel: m.kharcha_member_remove(),
			destructive: true,
		});
		if (!ok) return;
		try {
			await remove.mutateAsync({ groupId: group.id, personId: member.person.id });
			toast.success(m.kharcha_member_removed({ name: member.person.name }));
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	return (
		<section
			aria-labelledby="kharcha-group-members"
			className="flex flex-col gap-3"
			data-testid="kharcha-group-members"
		>
			<div className="flex flex-wrap items-center gap-3">
				<h2 id="kharcha-group-members" className="kh-display text-kh-head">
					{m.kharcha_group_members_title()}
				</h2>
				{group.can.edit ? (
					<Button
						variant="outline"
						className="ms-auto"
						onClick={() => setDialog({ kind: "add" })}
						data-testid="kharcha-member-add"
					>
						<UserPlusIcon aria-hidden />
						{m.kharcha_member_add()}
					</Button>
				) : null}
			</div>
			<ul className="max-w-2xl divide-y divide-kh-rule overflow-hidden rounded-lg border border-kh-hair bg-kh-page">
				{[...current, ...former].map((member) => {
					const friend = friendOf(member.person.id);
					return (
						<li
							key={member.person.id}
							className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 sm:px-5"
							data-testid="kharcha-member"
						>
							<PersonAvatar name={member.person.name} color={member.person.color} />
							<span className="min-w-0">
								<span className="block truncate font-medium">
									{member.person.isMe ? m.kharcha_member_you({ name: member.person.name }) : member.person.name}
								</span>
								<span className="block truncate text-caption text-kh-muted">
									{[
										member.role === "owner" ? m.kharcha_member_owner() : "",
										member.leftAt ? m.kharcha_member_left() : "",
										member.person.hasAccount ? "" : m.kharcha_friend_not_joined(),
									]
										.filter(Boolean)
										.join(" · ")}
								</span>
							</span>
							<span className="flex items-center gap-1">
								{group.can.edit && member.leftAt === null && friend?.canInvite ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setDialog({ kind: "invite", member })}
										data-testid="kharcha-member-invite"
									>
										<SendIcon aria-hidden />
										<span className="max-sm:sr-only">{m.kharcha_invite_action()}</span>
									</Button>
								) : null}
								{group.can.manage && member.leftAt === null && !member.person.isMe ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => void removeMember(member)}
										data-testid="kharcha-member-remove"
									>
										<UserMinusIcon aria-hidden />
										<span className="sr-only">{m.kharcha_member_remove_title({ name: member.person.name })}</span>
									</Button>
								) : null}
							</span>
						</li>
					);
				})}
			</ul>
			{dialog?.kind === "add" ? (
				<AddMemberDialog group={group} userId={userId} friends={friends} onClose={() => setDialog(null)} />
			) : null}
			{dialog?.kind === "invite" ? (
				<Suspense fallback={null}>
					<InviteDialog
						personId={dialog.member.person.id}
						name={dialog.member.person.name}
						groupId={group.id}
						userId={userId}
						onClose={() => setDialog(null)}
					/>
				</Suspense>
			) : null}
		</section>
	);
}

/** "Someone new" in the friend picker: a name, and an address when the caller isn't a guest. */
const NEW = "new";

const memberSchema = z
	.object({ personId: z.string(), name: z.string().trim().max(NAME_MAX), email: z.union([z.literal(""), email()]) })
	.refine((value) => value.personId !== NEW || value.name.length > 0, {
		path: ["name"],
		error: () => m.validation_required(),
	});

function AddMemberDialog({
	group,
	userId,
	friends,
	onClose,
}: {
	group: GroupView;
	userId: string;
	friends: ReadonlyArray<FriendView>;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const { data: me } = useQuery(kharchaMeQueryOptions(userId));
	const add = useMutation(kharchaMutations.addMember(queryClient, userId));
	const addNew = useMutation(kharchaMutations.addNewMember(queryClient, userId));
	const inGroup = new Set(group.members.filter((member) => member.leftAt === null).map((member) => member.person.id));
	const choosable = friends.filter((friend) => !inGroup.has(friend.person.id));
	const form = useAppForm({
		...formOptions({
			defaultValues: { personId: choosable[0]?.person.id ?? NEW, name: "", email: "" },
			validators: formValidators(memberSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				if (value.personId === NEW) {
					const address = value.email.trim();
					await addNew.mutateAsync({
						groupId: group.id,
						name: value.name.trim(),
						...(address ? { email: address } : {}),
					});
				} else {
					await add.mutateAsync({ groupId: group.id, personId: value.personId });
				}
				toast.success(m.kharcha_member_added());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const choice = useStore(form.store, (state) => state.values.personId);
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_member_add()}
				description={m.kharcha_member_add_description({ group: group.name })}
				submitLabel={m.kharcha_member_add_submit()}
				onClose={onClose}
				data-testid="kharcha-member-dialog"
			>
				<form.AppField name="personId">
					{(field) => (
						<field.SelectField
							label={m.kharcha_member_who()}
							options={[
								...choosable.map((friend) => ({ value: friend.person.id, label: friend.person.name })),
								{ value: NEW, label: m.kharcha_member_someone_new() },
							]}
						/>
					)}
				</form.AppField>
				{choice === NEW ? (
					<>
						<form.AppField name="name">
							{(field) => <field.TextField label={m.kharcha_field_name()} maxLength={NAME_MAX} autoComplete="off" />}
						</form.AppField>
						{me?.isGuest ? null : (
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
					</>
				) : null}
			</FormDialog>
		</form.AppForm>
	);
}

function Leaving({ group, userId }: { group: GroupView; userId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const confirm = useConfirm();
	const archive = useMutation(kharchaMutations.archiveGroup(queryClient, userId));
	const leave = useMutation(kharchaMutations.leaveGroup(queryClient, userId));
	if (group.left) return null;
	const toggleArchive = async () => {
		const ok = await confirm({
			title: group.archived ? m.kharcha_group_unarchive_title() : m.kharcha_group_archive_title(),
			description: group.archived ? m.kharcha_group_unarchive_description() : m.kharcha_group_archive_description(),
			confirmLabel: group.archived ? m.kharcha_group_unarchive() : m.kharcha_group_archive(),
		});
		if (!ok) return;
		try {
			await archive.mutateAsync({ groupId: group.id, archived: !group.archived });
			toast.success(group.archived ? m.kharcha_group_unarchived() : m.kharcha_group_archived_done());
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const leaveGroup = async () => {
		const ok = await confirm({
			title: m.kharcha_group_leave_title({ group: group.name }),
			description: m.kharcha_group_leave_description(),
			confirmLabel: m.kharcha_group_leave(),
			destructive: true,
		});
		if (!ok) return;
		try {
			await leave.mutateAsync(group.id);
			toast.success(m.kharcha_group_left({ group: group.name }));
			void navigate(kharchaLinks.people());
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	return (
		<section aria-labelledby="kharcha-group-leaving" className="flex max-w-2xl flex-col gap-3">
			<h2 id="kharcha-group-leaving" className="kh-display text-kh-head">
				{m.kharcha_group_leaving()}
			</h2>
			<p className="text-caption text-kh-muted">{m.kharcha_group_leaving_help()}</p>
			<div className="flex flex-wrap gap-2">
				{group.can.manage ? (
					<Button variant="outline" onClick={() => void toggleArchive()} data-testid="kharcha-group-archive">
						{group.archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
						{group.archived ? m.kharcha_group_unarchive() : m.kharcha_group_archive()}
					</Button>
				) : null}
				<Button variant="outline" onClick={() => void leaveGroup()} data-testid="kharcha-group-leave">
					<LogOutIcon aria-hidden />
					{m.kharcha_group_leave()}
				</Button>
			</div>
		</section>
	);
}
