import { formOptions, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import type { ImageAsset } from "@/features/attachments/schema";
import { createKharchaTag } from "@/functions/kharcha/lists";
import { CURRENCIES, type CurrencyCode, currencyLabel, money, toMajor, toMinor } from "@/lib/i18n/currency";
import { isoDate, optionalText } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { firstRule } from "../lists";
import { kharchaListsQueryOptions, kharchaMerchantsQueryOptions, kharchaMutations, refreshKharcha } from "../queries";
import { MERCHANT_MAX, NOTES_MAX, TITLE_MAX } from "../schema";
import type { ExpenseKind, ExpenseView, KharchaLists, KharchaMe, ReceiptDraftView } from "../types";
import { ReceiptsField } from "./receipts-field";

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
	/** After a save, with what was saved (the + menu opens nothing; a page may). */
	onSaved?: (expense: ExpenseView) => void;
};

/**
 * Add or edit an expense (PLAN Task 89): a dialog on a laptop, the whole screen on a phone.
 * Personal only in this task (splitting arrives in Task 90); a shared expense keeps its
 * people and split. The amount reads Devanagari digits; the merchant completes from the
 * caller's history, and choosing one fills the category, tags and method from a merchant
 * rule, or the category last given it, until the caller picks their own.
 */
export default function ExpenseDialog({ me, userId, onClose, expense, draft, files, onSaved }: ExpenseDialogProps) {
	const queryClient = useQueryClient();
	const { data: lists } = useQuery(kharchaListsQueryOptions(userId));
	const { data: merchants = [] } = useQuery(kharchaMerchantsQueryOptions(userId));
	const create = useMutation(kharchaMutations.createExpense(queryClient, userId));
	const update = useMutation(kharchaMutations.updateExpense(queryClient, userId));
	const [busy, setBusy] = useState(false);
	const [stale, setStale] = useState(false);
	const listId = useId();
	// What the caller chose themselves: the merchant's helpers never overwrite it.
	const chosen = useRef({ category: Boolean(expense), tags: Boolean(expense), method: Boolean(expense) });

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

	const form = useAppForm({
		...formOptions({ defaultValues: defaults, validators: formValidators(schema) }),
		onSubmit: async ({ value, formApi }) => {
			if (busy) {
				toast.error(m.kharcha_receipts_wait());
				return;
			}
			try {
				const tagIds = await tagIdsFor(value.tags, lists);
				const amountMinor = toMinor(value.amount ?? 0, value.currency);
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
				};
				const saved = expense
					? await update.mutateAsync({
							...fields,
							expenseId: expense.id,
							version: expense.version,
							...keptSplit(expense, amountMinor),
						})
					: await create.mutateAsync({ ...fields, groupId: null, ...(draft ? { draftId: draft.id } : {}) });
				toast.success(expense ? m.kharcha_expense_saved() : m.kharcha_expense_added());
				onSaved?.(saved);
				onClose();
			} catch (error) {
				handleSaveError(formApi, error, () => setStale(true));
			}
		},
	});

	const currency = useStore(form.store, (state) => state.values.currency);
	const categories = (lists?.categories ?? []).filter(
		(category) => !category.archived || category.id === expense?.mine.categoryId,
	);
	const methods = (lists?.methods ?? []).filter((method) => !method.archived || method.id === expense?.mine.methodId);

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

	return (
		<form.AppForm>
			<FormDialog
				title={expense ? m.kharcha_expense_edit() : m.kharcha_create_expense()}
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
							options={(["expense", "refund"] satisfies ExpenseKind[]).map((kind) => ({
								value: kind,
								label: kind === "expense" ? m.kharcha_kind_expense() : m.kharcha_kind_refund(),
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
					<form.AppField name="currency">
						{(field) => (
							<field.SelectField
								label={m.kharcha_field_currency()}
								options={currencies.map((code) => ({ value: code, label: currencyLabel(code) }))}
							/>
						)}
					</form.AppField>
				</div>
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

/**
 * A shared expense keeps its people and its split (Task 90 edits them): one payer pays
 * the new amount; several are kept as they were, and the server says when they no
 * longer add up.
 */
function keptSplit(expense: ExpenseView, amountMinor: number) {
	if (expense.people.length <= 1) return {};
	const [only, ...more] = expense.payers;
	const payers =
		only && more.length === 0 && amountMinor !== expense.amountMinor
			? [{ person: only.personId, amount: amountMinor }]
			: expense.payers.map((payer) => ({ person: payer.personId, amount: payer.amountMinor }));
	return { payers, split: expense.split };
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
