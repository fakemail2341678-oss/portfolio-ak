import { formOptions, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { errorMessage } from "@/components/errors/error-page";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
	CURRENCIES,
	type CurrencyCode,
	currencyLabel,
	formatMoney,
	minorDigits,
	money,
	toMajor,
	toMinor,
} from "@/lib/i18n/currency";
import { isoDate, optionalText } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { convertAt } from "../money/convert";
import {
	kharchaListsQueryOptions,
	kharchaMutations,
	kharchaPaymentQueryOptions,
	kharchaSettleUpQueryOptions,
	refreshKharcha,
} from "../queries";
import { METHOD_MAX, PAYMENT_NOTE_MAX, RATE_PATTERN } from "../schema";
import type { SettleStart } from "../shell/actions";
import type { KharchaMe, PaymentView, SettleChoice, SettleUp } from "../types";
import { transferSentence } from "./words";

/** "Someone else" in the choices: the payer and recipient are picked by hand. */
const CUSTOM = "custom";

const schema = z.object({
	choice: z.string(),
	fromId: z.string(),
	toId: z.string(),
	amount: z.number().optional(),
	currency: z.enum(CURRENCIES),
	other: z.boolean(),
	paidCurrency: z.enum(CURRENCIES),
	rate: z.string(),
	method: optionalText({ max: METHOD_MAX }),
	note: optionalText({ max: PAYMENT_NOTE_MAX }),
	paidOn: isoDate(),
});
type Values = z.infer<typeof schema>;

/** The smallest amount a currency has (one paisa, one yen). */
const smallest = (code: string) => toMajor(1, code);

/** What was handed over in the other currency at the typed rate, or null until the rate reads. */
const handedOver = (values: Pick<Values, "amount" | "currency" | "other" | "paidCurrency" | "rate">) => {
	if (!values.other || !values.amount || !RATE_PATTERN.test(values.rate.trim())) return null;
	if (values.paidCurrency === values.currency) return null;
	const amountMinor = toMinor(values.amount, values.currency);
	return {
		currency: values.paidCurrency,
		amountMinor: convertAt(
			amountMinor,
			minorDigits(values.currency),
			minorDigits(values.paidCurrency),
			values.rate.trim(),
		),
		rate: values.rate.trim(),
	};
};

/**
 * Settle up (Task 91, PLAN 14.5 "Money core"): a payment made elsewhere, recorded. A new one
 * starts from the open debts (a group's suggestions, a friend's balances, or all of the
 * caller's); editing one (`paymentId`) changes its amount, currency, method, note and date,
 * or sends it to the trash. Lazy: loaded with the first one opened.
 */
export default function SettleDialog({
	me,
	userId,
	start,
	onClose,
}: {
	me: KharchaMe;
	userId: string;
	start: SettleStart;
	onClose: () => void;
}) {
	const payment = useQuery({
		...kharchaPaymentQueryOptions(userId, start.paymentId ?? ""),
		enabled: Boolean(start.paymentId),
	});
	const options = useQuery({
		...kharchaSettleUpQueryOptions(userId, {
			groupId: start.groupId ?? null,
			...(start.personId ? { personId: start.personId } : {}),
		}),
		enabled: !start.paymentId,
	});
	const failed = start.paymentId ? payment.error : options.error;
	useEffect(() => {
		if (!failed) return;
		toast.error(errorMessage(failed));
		onClose();
	}, [failed, onClose]);
	if (start.paymentId) {
		return payment.data ? <PaymentForm me={me} userId={userId} onClose={onClose} payment={payment.data} /> : null;
	}
	return options.data ? (
		<PaymentForm me={me} userId={userId} onClose={onClose} options={options.data} start={start} />
	) : null;
}

type FormProps = { me: KharchaMe; userId: string; onClose: () => void } & (
	| { payment: PaymentView; options?: undefined; start?: undefined }
	| { payment?: undefined; options: SettleUp; start: SettleStart }
);

function sameChoice(a: SettleChoice, b: SettleChoice): boolean {
	return a.groupId === b.groupId && a.fromId === b.fromId && a.toId === b.toId && a.currency === b.currency;
}

function PaymentForm({ me, userId, onClose, payment, options, start }: FormProps) {
	const queryClient = useQueryClient();
	const { data: lists } = useQuery(kharchaListsQueryOptions(userId));
	const create = useMutation(kharchaMutations.createPayment(queryClient, userId));
	const update = useMutation(kharchaMutations.updatePayment(queryClient, userId));
	const trash = useMutation(kharchaMutations.trashPayment(queryClient, userId));
	const [stale, setStale] = useState(false);
	const methodsId = useId();

	const choices = options?.choices ?? [];
	const people = payment?.people ?? options?.people ?? [];
	const nameOf = (id: string) => {
		const person = people.find((each) => each.id === id);
		return person?.isMe ? m.kharcha_you_subject() : (person?.name ?? m.kharcha_someone());
	};
	const picked = start?.choice ? choices.findIndex((choice) => start.choice && sameChoice(choice, start.choice)) : -1;
	const first = picked >= 0 ? picked : choices.length > 0 ? 0 : -1;
	const firstChoice = choices[first];
	const currencies = [
		...new Set([
			...(payment ? [payment.currency] : []),
			...choices.map((choice) => choice.currency),
			...(options?.group ? [options.group.currency] : []),
			me.profile.homeCurrency,
			...me.currencies,
		]),
	] as CurrencyCode[];
	const other = (code: string) => currencies.find((each) => each !== code) ?? "USD";
	const startStart = payment ?? firstChoice;
	const startCurrency = (startStart?.currency ?? currencies[0] ?? "NPR") as CurrencyCode;
	const defaults: Values = {
		choice: firstChoice ? String(first) : CUSTOM,
		fromId: payment?.fromId ?? firstChoice?.fromId ?? me.person.id,
		toId: payment?.toId ?? firstChoice?.toId ?? options?.pickable.find((id) => id !== me.person.id) ?? me.person.id,
		amount: startStart ? toMajor(startStart.amountMinor, startStart.currency) : undefined,
		currency: startCurrency,
		other: Boolean(payment?.paid),
		paidCurrency: (payment?.paid?.currency ?? other(startCurrency)) as CurrencyCode,
		rate: payment?.paid?.rate ?? "",
		method: payment?.method ?? "",
		note: payment?.note ?? "",
		paidOn: payment?.paidOn ?? me.today,
	};

	const form = useAppForm({
		...formOptions({ defaultValues: defaults, validators: formValidators(schema) }),
		onSubmit: async ({ value, formApi }) => {
			const choice = value.choice === CUSTOM ? undefined : choices[Number(value.choice)];
			const groupId = payment?.groupId ?? choice?.groupId ?? options?.group?.id ?? null;
			if (!payment && value.fromId === value.toId) {
				toast.error(m.kharcha_error_payment_people());
				return;
			}
			if (!payment && groupId === null && value.fromId !== me.person.id && value.toId !== me.person.id) {
				toast.error(m.kharcha_error_not_involved());
				return;
			}
			const paid = value.other ? handedOver(value) : null;
			if (value.other && !paid) {
				toast.error(m.kharcha_settle_rate_invalid());
				return;
			}
			const fields = {
				amountMinor: toMinor(value.amount ?? 0, value.currency),
				currency: value.currency,
				paid,
				method: value.method.trim(),
				note: value.note.trim(),
				paidOn: value.paidOn,
			};
			try {
				if (payment) {
					await update.mutateAsync({ ...fields, paymentId: payment.id, version: payment.version });
					toast.success(m.kharcha_settle_saved());
				} else {
					await create.mutateAsync({ ...fields, groupId, fromId: value.fromId, toId: value.toId });
					toast.success(m.kharcha_settle_recorded());
				}
				onClose();
			} catch (error) {
				handleSaveError(formApi, error, () => setStale(true));
			}
		},
	});

	const values = useStore(form.store, (state) => state.values);
	const chosen = values.choice === CUSTOM ? undefined : choices[Number(values.choice)];
	const handed = handedOver(values);
	// How the recipient asked to be paid; never the caller's own.
	const payNote = values.toId === me.person.id ? "" : (options?.payNotes[values.toId] ?? "");
	const full = chosen && chosen.currency === values.currency ? chosen.amountMinor : null;
	const typedMinor = values.amount ? toMinor(values.amount, values.currency) : 0;
	const pickable = (options?.pickable ?? []).flatMap((id) => {
		const person = people.find((each) => each.id === id);
		return person ? [{ value: person.id, label: person.isMe ? m.kharcha_you_subject() : person.name }] : [];
	});

	const remove = async () => {
		if (!payment) return;
		try {
			await trash.mutateAsync({ paymentId: payment.id, restore: false });
			onClose();
			toast.success(m.kharcha_settle_deleted(), {
				action: {
					label: m.kharcha_undo(),
					onClick: () => {
						trash.mutate({ paymentId: payment.id, restore: true });
					},
				},
			});
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	return (
		<form.AppForm>
			<FormDialog
				title={payment ? m.kharcha_settle_edit() : m.kharcha_create_settle()}
				description={
					payment
						? m.kharcha_settle_edit_description({ who: paymentWho(payment, nameOf) })
						: options?.group
							? m.kharcha_settle_group_description({ group: options.group.name })
							: m.kharcha_settle_description()
				}
				submitLabel={payment ? m.kharcha_settle_save() : m.kharcha_settle_record()}
				onClose={onClose}
				stale={stale ? () => refreshKharcha(queryClient, userId).then(onClose) : undefined}
				className="sm:max-w-lg max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
				data-testid="kharcha-settle-dialog"
			>
				{payment ? null : (
					<form.AppField
						name="choice"
						listeners={{
							onChange: ({ value }) => {
								const next = value === CUSTOM ? undefined : choices[Number(value)];
								if (!next) return;
								form.setFieldValue("fromId", next.fromId);
								form.setFieldValue("toId", next.toId);
								form.setFieldValue("currency", next.currency as CurrencyCode);
								form.setFieldValue("amount", toMajor(next.amountMinor, next.currency));
							},
						}}
					>
						{(field) => (
							<field.RadioGroupField
								label={m.kharcha_settle_choices()}
								description={choices.length === 0 ? m.kharcha_settle_nothing_open() : undefined}
								options={[
									...choices.map((choice, index) => ({
										value: String(index),
										label: transferSentence(choice, people),
										description: choice.group ?? m.kharcha_settle_outside_groups(),
									})),
									{ value: CUSTOM, label: m.kharcha_settle_custom(), description: m.kharcha_settle_custom_help() },
								]}
							/>
						)}
					</form.AppField>
				)}

				{payment || values.choice !== CUSTOM ? null : (
					<div className="grid gap-4 sm:grid-cols-2">
						<form.AppField name="fromId">
							{(field) => <field.SelectField label={m.kharcha_settle_from()} options={pickable} />}
						</form.AppField>
						<form.AppField name="toId">
							{(field) => <field.SelectField label={m.kharcha_settle_to()} options={pickable} />}
						</form.AppField>
					</div>
				)}

				{payNote ? (
					<p
						className="rounded-md border border-kh-hair bg-kh-ground px-3 py-2 text-sm"
						data-testid="kharcha-settle-pay-note"
					>
						<span className="font-medium">{m.kharcha_settle_pay_note({ name: nameOf(values.toId) })}</span>{" "}
						<span className="break-words">{payNote}</span>
					</p>
				) : null}

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
						{(field) => (
							<field.CurrencyField
								label={m.kharcha_field_amount()}
								description={
									full !== null
										? typedMinor > 0 && typedMinor < full
											? m.kharcha_settle_partial({ amount: formatMoney(full - typedMinor, values.currency) })
											: m.kharcha_settle_full({ amount: formatMoney(full, values.currency) })
										: undefined
								}
								currency={values.currency}
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

				<form.AppField name="other">
					{(field) => (
						<field.CheckboxField label={m.kharcha_settle_other()} description={m.kharcha_settle_other_help()} />
					)}
				</form.AppField>
				{values.other ? (
					<div className="flex flex-col gap-2">
						<div className="grid gap-4 sm:grid-cols-2">
							<form.AppField name="paidCurrency">
								{(field) => (
									<field.SelectField
										label={m.kharcha_settle_paid_currency()}
										options={currencies
											.filter((code) => code !== values.currency)
											.map((code) => ({ value: code, label: currencyLabel(code) }))}
									/>
								)}
							</form.AppField>
							<form.AppField name="rate">
								{(field) => (
									<field.TextField
										label={m.kharcha_settle_rate({ from: values.currency, to: values.paidCurrency })}
										inputMode="decimal"
										autoComplete="off"
									/>
								)}
							</form.AppField>
						</div>
						<p className="text-caption text-kh-muted" aria-live="polite" data-testid="kharcha-settle-handed">
							{handed
								? m.kharcha_settle_handed({ amount: formatMoney(handed.amountMinor, handed.currency) })
								: m.kharcha_settle_rate_help()}
						</p>
					</div>
				) : null}

				<div className="grid gap-4 sm:grid-cols-2">
					<form.AppField name="method">
						{(field) => (
							<field.TextField
								label={m.kharcha_field_method()}
								optional
								maxLength={METHOD_MAX}
								list={methodsId}
								autoComplete="off"
							/>
						)}
					</form.AppField>
					<form.AppField name="paidOn">{(field) => <field.DateField label={m.kharcha_field_date()} />}</form.AppField>
				</div>
				<datalist id={methodsId}>
					{(lists?.methods ?? [])
						.filter((method) => !method.archived)
						.map((method) => (
							<option key={method.id} value={method.name} />
						))}
				</datalist>
				<form.AppField name="note">
					{(field) => (
						<field.TextareaField label={m.kharcha_field_notes()} optional maxLength={PAYMENT_NOTE_MAX} rows={2} />
					)}
				</form.AppField>

				{payment?.can.delete ? (
					<div className="flex justify-start border-kh-hair border-t pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => void remove()}
							disabled={trash.isPending}
							data-testid="kharcha-settle-delete"
						>
							<Trash2Icon aria-hidden />
							{m.kharcha_settle_delete()}
						</Button>
					</div>
				) : null}
			</FormDialog>
		</form.AppForm>
	);
}

/** "Bikash paid you", "You paid Asha", "Bikash paid Asha". */
function paymentWho(payment: PaymentView, nameOf: (id: string) => string): string {
	const from = payment.people.find((person) => person.id === payment.fromId);
	const to = payment.people.find((person) => person.id === payment.toId);
	if (from?.isMe) return m.kharcha_kit_payment_you_paid({ to: nameOf(payment.toId) });
	if (to?.isMe) return m.kharcha_kit_payment_paid_you({ from: nameOf(payment.fromId) });
	return m.kharcha_kit_payment_line({ from: nameOf(payment.fromId), to: nameOf(payment.toId) });
}
