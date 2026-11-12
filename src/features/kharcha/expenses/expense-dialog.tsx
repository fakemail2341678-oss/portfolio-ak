import { formOptions, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { NativeSelect } from "@/components/ui/native-select";
import type { ImageAsset } from "@/features/attachments/schema";
import { createKharchaTag } from "@/functions/kharcha/lists";
import {
	CURRENCIES,
	type CurrencyCode,
	currencyLabel,
	minorDigits,
	money,
	toMajor,
	toMinor,
} from "@/lib/i18n/currency";
import { isoDate, optionalText } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { firstRule } from "../lists";
import { splitProblemMessage } from "../money/problem";
import type { Paid, Split } from "../money/split";
import {
	kharchaFriendsQueryOptions,
	kharchaGroupQueryOptions,
	kharchaGroupsQueryOptions,
	kharchaListsQueryOptions,
	kharchaMerchantsQueryOptions,
	kharchaMutations,
	refreshKharcha,
} from "../queries";
import { MERCHANT_MAX, NOTES_MAX, TITLE_MAX } from "../schema";
import type { ExpenseKind, ExpenseView, KharchaLists, KharchaMe, KharchaPerson, ReceiptDraftView } from "../types";
import { ReceiptsField } from "./receipts-field";
import { buildSplit, draftFrom, newDraft, type SplitDraft, withPeople } from "./split-model";

const SplitEditor = lazy(() => import("./split-editor"));

/** "None" in a picker: shadcn's Select has no empty value. */
const NONE = "none";

const schema = z.object({
	kind: z.enum(["expense", "refund"]),
	amount: z.number().optional(),
	currency: z.enum(CURRENCIES),
	spentOn: isoDate(),
	merchant: optionalText({ max: MERCHANT_MAX }),
	title: optionalText({ max: TITLE_MAX }),
	categoryId: z.string(),
	tags: z.array(z.string()),
	methodId: z.string(),
	notes: optionalText({ max: NOTES_MAX }),
	receipts: z.array(z.custom<ImageAsset>()),
});
type Values = z.infer<typeof schema>;

/** The smallest amount a currency has (one paisa, one yen). */
const smallest = (code: string) => toMajor(1, code);

/** Who the expense is split with (Task 90): nobody, a group's members, or some friends. */
type SplitWith = { kind: "none" } | { kind: "group"; groupId: string } | { kind: "friends"; ids: string[] };

export type ExpenseDialogProps = {
	me: KharchaMe;
	userId: string;
	onClose: () => void;
	/** The expense to edit; without it, a new one. */
	expense?: ExpenseView;
	/** A receipt draft to make the expense from: its files come with it. */
	draft?: ReceiptDraftView;
	/** Files to upload at once (dropped on the page). */
	files?: ReadonlyArray<File>;
	/** A new expense in this group (its page's Add expense). */
	groupId?: string;
	/** A new expense split with these friends (a friend's page). */
	with?: ReadonlyArray<string>;
	/** "Split a bill": open with friends to pick. */
	split?: boolean;
	/** After a save, with what was saved (the + menu opens nothing; a page may). */
	onSaved?: (expense: ExpenseView) => void;
};

const startingWith = (props: ExpenseDialogProps): SplitWith => {
	const { expense, me } = props;
	if (expense?.groupId) return { kind: "group", groupId: expense.groupId };
	if (expense) {
		const others = expense.people.filter((person) => person.id !== me.person.id).map((person) => person.id);
		return others.length > 0 ? { kind: "friends", ids: others } : { kind: "none" };
	}
	if (props.groupId) return { kind: "group", groupId: props.groupId };
	if (props.with?.length) return { kind: "friends", ids: [...props.with] };
	return props.split ? { kind: "friends", ids: [] } : { kind: "none" };
};

/**
 * Add or edit an expense (PLAN Tasks 89 and 90): a dialog on a laptop, the whole screen on a
 * phone. The amount reads Devanagari digits; the merchant completes from the caller's
 * history, and choosing one fills the category, tags and method from a merchant rule, or
 * the category last given it, until the caller picks their own. "Split with" a group or
 * friends opens the split editor (lazy); each person's share then carries their own
 * category (the server gives them theirs).
 */
export default function ExpenseDialog(props: ExpenseDialogProps) {
	const { me, userId, onClose, expense, draft, files, onSaved } = props;
	const queryClient = useQueryClient();
	const { data: lists } = useQuery(kharchaListsQueryOptions(userId));
	const { data: merchants = [] } = useQuery(kharchaMerchantsQueryOptions(userId));
	const { data: friends = [] } = useQuery(kharchaFriendsQueryOptions(userId));
	const { data: groups = [] } = useQuery(kharchaGroupsQueryOptions(userId));
	const create = useMutation(kharchaMutations.createExpense(queryClient, userId));
	const update = useMutation(kharchaMutations.updateExpense(queryClient, userId));
	const [busy, setBusy] = useState(false);
	const [stale, setStale] = useState(false);
	const [splitWith, setSplitWith] = useState<SplitWith>(() => startingWith(props));
	const [splitDraft, setSplitDraft] = useState<SplitDraft | null>(null);
	const listId = useId();
	const splitId = useId();
	// What the caller chose themselves: the merchant's helpers never overwrite it.
	const chosen = useRef({
		category: Boolean(expense),
		tags: Boolean(expense),
		method: Boolean(expense),
		currency: Boolean(expense),
	});
	const groupId = splitWith.kind === "group" ? splitWith.groupId : null;
	const { data: group } = useQuery({ ...kharchaGroupQueryOptions(userId, groupId ?? ""), enabled: groupId !== null });

	const currencies = [
		...new Set([...(expense ? [expense.currency] : []), me.profile.homeCurrency, ...me.currencies]),
	].filter((code): code is CurrencyCode => (CURRENCIES as ReadonlyArray<string>).includes(code));
	const defaults: Values = expense
		? {
				kind: expense.kind,
				amount: toMajor(expense.amountMinor, expense.currency),
				currency: expense.currency as CurrencyCode,
				spentOn: expense.spentOn,
				merchant: expense.merchant,
				title: expense.title,
				categoryId: expense.mine.categoryId ?? NONE,
				tags: expense.tags.map((tag) => tag.name),
				methodId: expense.mine.methodId ?? NONE,
				notes: expense.notes,
				receipts: expense.receipts,
			}
		: {
				kind: "expense",
				amount: undefined,
				currency: (currencies[0] ?? "NPR") as CurrencyCode,
				spentOn: me.today,
				merchant: "",
				title: "",
				categoryId: NONE,
				tags: [],
				methodId: NONE,
				notes: "",
				receipts: draft?.receipts ?? [],
			};

	// Everyone the expense can name now: the group's current members (and whoever is on it
	// already), or the caller and the friends picked.
	const known = new Map<string, KharchaPerson>([
		[me.person.id, me.person],
		...friends.map((friend) => [friend.person.id, friend.person] as const),
		...(group?.members ?? []).map((member) => [member.person.id, member.person] as const),
		...(expense?.people ?? []).map((person) => [person.id, person] as const),
	]);
	const participantIds =
		splitWith.kind === "group"
			? [
					...new Set([
						...(group?.members ?? []).filter((member) => member.leftAt === null).map((member) => member.person.id),
						...(expense?.groupId === splitWith.groupId ? expense.people.map((person) => person.id) : []),
					]),
				]
			: splitWith.kind === "friends"
				? [me.person.id, ...splitWith.ids]
				: [me.person.id];
	const participants = participantIds.flatMap((id) => {
		const person = known.get(id);
		return person ? [person] : [];
	});
	const sharing = participants.length > 1;
	const defaultMethod = group?.settings.defaultSplit ?? me.profile.defaultSplit;

	/** The editor's draft for these people: kept as typed, people joining and leaving it. */
	const draftFor = (people: ReadonlyArray<string>, currency: string): SplitDraft => {
		if (splitDraft) return withPeople(splitDraft, people, me.person.id);
		if (expense && expense.people.length > 1) {
			return withPeople(
				draftFrom(
					expense.split,
					expense.payers,
					expense.people.map((person) => person.id),
					me.person.id,
					minorDigits(currency),
				),
				people,
				me.person.id,
			);
		}
		return newDraft(people, me.person.id, defaultMethod === "full" ? "equal" : defaultMethod);
	};
	// The first draft is kept at once, so its lines keep their keys while the rest is typed.
	if (sharing && splitDraft === null) setSplitDraft(draftFor(participantIds, defaults.currency));

	const form = useAppForm({
		...formOptions({ defaultValues: defaults, validators: formValidators(schema) }),
		onSubmit: async ({ value, formApi }) => {
			if (busy) {
				toast.error(m.kharcha_receipts_wait());
				return;
			}
			try {
				const amountMinor = toMinor(value.amount ?? 0, value.currency);
				let shared: { payers: Paid[]; split: Split } | null = null;
				if (sharing) {
					const built = buildSplit(draftFor(participantIds, value.currency), amountMinor, value.currency, value.kind);
					if (!built.ok) {
						toast.error(splitProblemMessage(built.problem, value.currency));
						return;
					}
					shared = { payers: built.payers, split: built.split };
				} else if (splitWith.kind !== "none") {
					toast.error(m.kharcha_split_pick_people());
					return;
				}
				const tagIds = await tagIdsFor(value.tags, lists);
				const fields = {
					kind: value.kind,
					title: value.title.trim(),
					merchant: value.merchant.trim(),
					notes: value.notes.trim(),
					amountMinor,
					currency: value.currency,
					spentOn: value.spentOn,
					categoryId: value.categoryId === NONE ? null : value.categoryId,
					tagIds,
					methodId: value.methodId === NONE ? null : value.methodId,
					receiptIds: value.receipts.map((receipt) => receipt.id),
					...(shared ?? {}),
				};
				const saved = expense
					? await update.mutateAsync({ ...fields, expenseId: expense.id, version: expense.version })
					: await create.mutateAsync({ ...fields, groupId, ...(draft ? { draftId: draft.id } : {}) });
				toast.success(expense ? m.kharcha_expense_saved() : m.kharcha_expense_added());
				onSaved?.(saved);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error, () => setStale(true));
			}
		},
	});

	const currency = useStore(form.store, (state) => state.values.currency);
	const kind = useStore(form.store, (state) => state.values.kind);
	const amount = useStore(form.store, (state) => state.values.amount);
	const amountMinor = amount && Number.isFinite(amount) ? toMinor(amount, currency) : 0;
	const categories = (lists?.categories ?? []).filter(
		(category) => !category.archived || category.id === expense?.mine.categoryId,
	);
	const methods = (lists?.methods ?? []).filter((method) => !method.archived || method.id === expense?.mine.methodId);
	const openGroups = groups.filter((each) => !each.left && !each.archived);
	const pickable = friends.filter(
		(friend) => !friend.hidden || (splitWith.kind === "friends" && splitWith.ids.includes(friend.person.id)),
	);

	/** A merchant picked or typed: the rule that matches it, else the category last given it, fills what wasn't chosen. */
	const helpWith = (merchant: string) => {
		if (!lists) return;
		const rule = firstRule(lists.rules, merchant);
		const known = merchants.find((each) => each.merchant.toLowerCase() === merchant.trim().toLowerCase());
		const category = rule?.categoryId ?? known?.categoryId ?? null;
		const live = (id: string | null) =>
			id && lists.categories.some((each) => each.id === id && !each.archived) ? id : null;
		if (!chosen.current.category && live(category)) form.setFieldValue("categoryId", live(category) ?? NONE);
		if (rule && !chosen.current.tags && rule.tagIds.length > 0) {
			form.setFieldValue(
				"tags",
				rule.tagIds.flatMap((id) => lists.tags.filter((tag) => tag.id === id).map((tag) => tag.name)),
			);
		}
		if (rule?.methodId && !chosen.current.method) form.setFieldValue("methodId", rule.methodId);
	};

	/** "Split with" changed: a group brings its currency until the caller picks one. */
	const chooseSplit = (value: string) => {
		if (value === NONE) setSplitWith({ kind: "none" });
		else if (value === "friends") setSplitWith({ kind: "friends", ids: [] });
		else {
			setSplitWith({ kind: "group", groupId: value });
			const picked = groups.find((each) => each.id === value);
			if (picked && !chosen.current.currency && currencies.includes(picked.currency as CurrencyCode)) {
				form.setFieldValue("currency", picked.currency as CurrencyCode);
			}
		}
	};
	const toggleFriend = (personId: string, on: boolean) => {
		if (splitWith.kind !== "friends") return;
		setSplitWith({
			kind: "friends",
			ids: on ? [...splitWith.ids, personId] : splitWith.ids.filter((id) => id !== personId),
		});
	};
	// A group's expense stays in its group; elsewhere the people can change.
	const fixedGroup = Boolean(expense?.groupId);

	return (
		<form.AppForm>
			<FormDialog
				title={expense ? m.kharcha_expense_edit() : props.split ? m.kharcha_create_split() : m.kharcha_create_expense()}
				description={draft ? m.kharcha_expense_from_draft() : m.kharcha_expense_description()}
				submitLabel={expense ? m.kharcha_expense_save() : m.kharcha_expense_add()}
				onClose={onClose}
				stale={stale ? () => refreshKharcha(queryClient, userId).then(onClose) : undefined}
				className="sm:max-w-xl max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
				data-testid="kharcha-expense-dialog"
			>
				<form.AppField name="kind">
					{(field) => (
						<field.RadioGroupField
							label={m.kharcha_field_kind()}
							options={(["expense", "refund"] satisfies ExpenseKind[]).map((each) => ({
								value: each,
								label: each === "expense" ? m.kharcha_kind_expense() : m.kharcha_kind_refund(),
							}))}
						/>
					)}
				</form.AppField>
				<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
					<form.AppField
						name="amount"
						validators={{
							onChangeListenTo: ["currency"],
							onChange: ({ value, fieldApi }) => {
								const code = fieldApi.form.getFieldValue("currency");
								const result = money(code, { min: smallest(code) }).safeParse(value);
								return result.success ? undefined : result.error.issues[0]?.message;
							},
						}}
					>
						{(field) => <field.CurrencyField label={m.kharcha_field_amount()} currency={currency} />}
					</form.AppField>
					<form.AppField name="currency" listeners={{ onChange: () => (chosen.current.currency = true) }}>
						{(field) => (
							<field.SelectField
								label={m.kharcha_field_currency()}
								options={currencies.map((code) => ({ value: code, label: currencyLabel(code) }))}
							/>
						)}
					</form.AppField>
				</div>

				<div className="flex flex-col gap-2">
					<label htmlFor={splitId} className="font-medium text-sm">
						{m.kharcha_split_with()}
					</label>
					<NativeSelect
						id={splitId}
						value={splitWith.kind === "group" ? splitWith.groupId : splitWith.kind === "friends" ? "friends" : NONE}
						onChange={(event) => chooseSplit(event.target.value)}
						disabled={fixedGroup}
						data-testid="kharcha-split-with"
					>
						{fixedGroup ? null : <option value={NONE}>{m.kharcha_split_with_none()}</option>}
						{fixedGroup ? null : <option value="friends">{m.kharcha_split_with_friends()}</option>}
						{(fixedGroup ? groups.filter((each) => each.id === expense?.groupId) : openGroups).map((each) => (
							<option key={each.id} value={each.id}>
								{m.kharcha_split_with_group({ group: each.name })}
							</option>
						))}
					</NativeSelect>
					{splitWith.kind === "friends" ? (
						pickable.length === 0 ? (
							<p className="text-caption text-kh-muted">{m.kharcha_split_no_friends()}</p>
						) : (
							<fieldset className="flex flex-wrap gap-1.5" data-testid="kharcha-split-friends">
								<legend className="sr-only">{m.kharcha_split_with_friends()}</legend>
								{pickable.map((friend) => (
									<label
										key={friend.person.id}
										className="kh-ease flex cursor-pointer items-center gap-1.5 rounded-full border border-kh-hair px-2.5 py-1 text-sm has-[:checked]:border-kh-ink has-[:checked]:bg-kh-sel has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
									>
										<input
											type="checkbox"
											className="size-3.5 accent-[var(--kh-act)]"
											checked={splitWith.ids.includes(friend.person.id)}
											onChange={(event) => toggleFriend(friend.person.id, event.target.checked)}
										/>
										{friend.person.name}
									</label>
								))}
							</fieldset>
						)
					) : null}
				</div>
				{sharing ? (
					<Suspense fallback={null}>
						<SplitEditor
							draft={draftFor(participantIds, currency)}
							onChange={setSplitDraft}
							people={participants}
							amountMinor={amountMinor}
							currency={currency}
							kind={kind}
						/>
					</Suspense>
				) : null}

				<form.AppField name="spentOn">{(field) => <field.DateField label={m.kharcha_field_date()} />}</form.AppField>
				<form.AppField
					name="merchant"
					listeners={{ onChange: ({ value }) => helpWith(value), onChangeDebounceMs: 250 }}
				>
					{(field) => (
						<field.TextField
							label={m.kharcha_field_merchant()}
							optional
							maxLength={MERCHANT_MAX}
							list={listId}
							autoComplete="off"
						/>
					)}
				</form.AppField>
				<datalist id={listId}>
					{merchants.map((each) => (
						<option key={each.merchant} value={each.merchant} />
					))}
				</datalist>
				<form.AppField name="title">
					{(field) => (
						<field.TextField
							label={m.kharcha_field_title()}
							description={m.kharcha_field_title_help()}
							optional
							maxLength={TITLE_MAX}
							autoComplete="off"
						/>
					)}
				</form.AppField>
				<div className="grid gap-4 sm:grid-cols-2">
					<form.AppField name="categoryId" listeners={{ onChange: () => (chosen.current.category = true) }}>
						{(field) => (
							<field.SelectField
								label={m.kharcha_field_category()}
								description={sharing ? m.kharcha_field_category_shared_help() : undefined}
								options={[
									{ value: NONE, label: m.kharcha_category_none() },
									...categories.map((category) => ({ value: category.id, label: category.name })),
								]}
							/>
						)}
					</form.AppField>
					<form.AppField name="methodId" listeners={{ onChange: () => (chosen.current.method = true) }}>
						{(field) => (
							<field.SelectField
								label={m.kharcha_field_method()}
								options={[
									{ value: NONE, label: m.kharcha_method_none() },
									...methods.map((method) => ({ value: method.id, label: method.name })),
								]}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="tags" listeners={{ onChange: () => (chosen.current.tags = true) }}>
					{(field) => (
						<field.TagsInputField label={m.kharcha_field_tags()} description={m.kharcha_field_tags_help()} optional />
					)}
				</form.AppField>
				<form.AppField name="receipts">
					{(field) => (
						<ReceiptsField
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBusyChange={setBusy}
							max={me.receiptsMax}
							incoming={files ?? []}
							saved={[...(expense?.receipts ?? []), ...(draft?.receipts ?? [])].map((receipt) => receipt.id)}
						/>
					)}
				</form.AppField>
				<form.AppField name="notes">
					{(field) => <field.TextareaField label={m.kharcha_field_notes()} optional maxLength={NOTES_MAX} rows={3} />}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

/** The tags' ids, making the ones the caller typed that they don't have yet. */
async function tagIdsFor(names: ReadonlyArray<string>, lists: KharchaLists | undefined): Promise<string[]> {
	let known = lists?.tags ?? [];
	const ids: string[] = [];
	for (const name of names) {
		const find = () => known.find((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());
		if (!find()) known = (await createKharchaTag({ data: { name } })).tags;
		const tag = find();
		if (tag && !ids.includes(tag.id)) ids.push(tag.id);
	}
	return ids;
}
