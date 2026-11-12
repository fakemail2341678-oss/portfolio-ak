import "@tanstack/react-start/server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { CreatePaymentInput, UpdatePaymentInput } from "@/features/kharcha/schema";
import type { PaymentView } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import type { IsoDate } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { type KhPaymentRow, khPayment } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import {
	assertGroupCan,
	assertSourceCan,
	type KharchaServices,
	type Me,
	type PaymentAccess,
	resolveFriend,
	resolveGroup,
	resolveMe,
	resolvePayment,
} from "../access";
import { type ActivityScope, fieldChanges, pairOf, recordActivity } from "../activity";
import { currentMembersAmong } from "../expenses/repository";
import { writeLedger } from "../ledger";
import { befriend, loadPeople } from "../people";
import { bumpRevs, saveVersioned } from "../rev";
import { assertCurrencyOffered, assertFormerSettled, touched } from "../rules";
import { assertQuota, getSettings, quotasFor } from "../settings";

/**
 * Kharcha's payments (docs/guides/kharcha.md "Payments"): settling up, recorded. A payment
 * from X to Y writes "Y owes X" to the ledger, which takes it off what X owed Y. Every
 * write is one transaction, as an expense's.
 */

const scopeOf = (payment: Pick<KhPaymentRow, "groupId" | "fromPerson" | "toPerson">): ActivityScope => ({
	groupId: payment.groupId,
	pair: payment.groupId ? null : pairOf([payment.fromPerson, payment.toPerson]),
});

/** What was handed over in another currency, as columns: all three or none. */
const paidColumns = (paid: { currency: string; amountMinor: number; rate: string } | null) => ({
	paidCurrency: paid?.currency ?? null,
	paidAmountMinor: paid?.amountMinor ?? null,
	rate: paid?.rate ?? null,
});

export type NewPayment = {
	id?: string | undefined;
	groupId: string | null;
	fromId: string;
	toId: string;
	amountMinor: number;
	currency: string;
	paid: { currency: string; amountMinor: number; rate: string } | null;
	method: string;
	note: string;
	paidOn: IsoDate;
};

/** Writes a new payment once access is settled (the services, and the sample data). */
export async function addPayment(tx: Tx, actorId: string, input: NewPayment): Promise<KhPaymentRow> {
	const [payment] = await tx
		.insert(khPayment)
		.values({
			...(input.id ? { id: input.id } : {}),
			groupId: input.groupId,
			fromPerson: input.fromId,
			toPerson: input.toId,
			amountMinor: input.amountMinor,
			currency: input.currency,
			...paidColumns(input.paid),
			method: input.method,
			note: input.note,
			paidOn: input.paidOn,
			createdBy: actorId,
		})
		.returning();
	if (!payment) throw new Error("kh_payment: nothing inserted");
	await writeLedger(tx, { payment });
	await befriend(tx, [[payment.fromPerson, payment.toPerson]]);
	await recordActivity(tx, actorId, scopeOf(payment), { kind: "payment.created", paymentId: payment.id });
	await bumpRevs(tx, await touched(tx, payment.groupId, [actorId, payment.fromPerson, payment.toPerson]));
	return payment;
}

async function paymentView(tx: Tx, me: Me, access: PaymentAccess): Promise<PaymentView> {
	const { payment } = access;
	return {
		id: payment.id,
		groupId: payment.groupId,
		fromId: payment.fromPerson,
		toId: payment.toPerson,
		amountMinor: payment.amountMinor,
		currency: payment.currency,
		paid:
			payment.paidCurrency && payment.paidAmountMinor !== null && payment.rate !== null
				? { currency: payment.paidCurrency, amountMinor: payment.paidAmountMinor, rate: payment.rate }
				: null,
		method: payment.method,
		note: payment.note,
		paidOn: payment.paidOn,
		people: await loadPeople(tx, me.personId, [payment.fromPerson, payment.toPerson, payment.createdBy]),
		createdBy: payment.createdBy,
		version: payment.version,
		deletedAt: payment.deletedAt?.toISOString() ?? null,
		createdAt: payment.createdAt.toISOString(),
		can: access.can,
	};
}

export async function getPayment({ db, user }: KharchaServices, paymentId: string): Promise<PaymentView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		return paymentView(tx, me, await resolvePayment(tx, me, paymentId));
	});
}

/**
 * Records a payment. In a group: between two of its current members, by any of them.
 * Outside one: the caller paid a friend, or a friend paid the caller.
 */
export async function createPayment({ db, user }: KharchaServices, input: CreatePaymentInput): Promise<PaymentView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const group = input.groupId ? await resolveGroup(tx, me, input.groupId) : null;
		if (input.fromId === input.toId) {
			throw ruleError("BAD_REQUEST", "Kharcha payment: one person", m.kharcha_error_payment_people());
		}
		if (group) {
			assertGroupCan(group, "edit");
			const members = await currentMembersAmong(tx, group.group.id, [input.fromId, input.toId]);
			if (members.size !== 2) {
				throw ruleError("BAD_REQUEST", "Kharcha: not a member of the group", m.kharcha_error_not_member());
			}
		} else {
			const other = input.fromId === me.personId ? input.toId : input.toId === me.personId ? input.fromId : null;
			if (!other) {
				throw ruleError("BAD_REQUEST", "Kharcha: the caller isn't on the payment", m.kharcha_error_not_involved());
			}
			await resolveFriend(tx, me, other);
		}
		const settings = await getSettings(tx);
		assertCurrencyOffered(settings, input.currency);
		if (input.paid) assertCurrencyOffered(settings, input.paid.currency);
		await assertQuota(tx, `${me.personId}:payments`, {
			table: khPayment,
			where: eq(khPayment.createdBy, me.personId),
			max: quotasFor(settings, user).payments,
		});
		const payment = await addPayment(tx, me.personId, input);
		return paymentView(tx, me, { payment, group, can: { edit: true, delete: true, restore: false } });
	});
}

/** The payment form's save, at the `version` it was loaded with. Who paid whom doesn't change: delete it and record another. */
export async function updatePayment({ db, user }: KharchaServices, input: UpdatePaymentInput): Promise<PaymentView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolvePayment(tx, me, input.paymentId);
		assertSourceCan(access, "edit");
		const before = access.payment;
		if (input.currency !== before.currency || (input.paid && input.paid.currency !== before.paidCurrency)) {
			const settings = await getSettings(tx);
			assertCurrencyOffered(settings, input.currency);
			if (input.paid) assertCurrencyOffered(settings, input.paid.currency);
		}
		const payment = await saveVersioned(tx, khPayment, {
			id: before.id,
			version: input.version,
			what: "Payment",
			set: {
				amountMinor: input.amountMinor,
				currency: input.currency,
				...paidColumns(input.paid),
				method: input.method,
				note: input.note,
				paidOn: input.paidOn,
			},
		});
		await writeLedger(tx, { payment });
		if (payment.groupId) await assertFormerSettled(tx, payment.groupId);
		const scalars = (row: KhPaymentRow) => ({
			amountMinor: row.amountMinor,
			currency: row.currency,
			paidOn: row.paidOn,
			method: row.method,
			note: row.note,
		});
		await recordActivity(
			tx,
			me.personId,
			scopeOf(payment),
			...fieldChanges("payment.updated", scalars(before), scalars(payment)).map((entry) => ({
				...entry,
				paymentId: payment.id,
			})),
		);
		await bumpRevs(tx, await touched(tx, payment.groupId, [me.personId, payment.fromPerson, payment.toPerson]));
		return paymentView(tx, me, { ...access, payment });
	});
}

async function setDeleted(
	{ db, user }: KharchaServices,
	paymentId: string,
	deleted: boolean,
	now = new Date(),
): Promise<PaymentView> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolvePayment(tx, me, paymentId, now);
		assertSourceCan(access, deleted ? "delete" : "restore");
		const [payment] = await tx
			.update(khPayment)
			.set({ deletedAt: deleted ? now : null })
			.where(and(eq(khPayment.id, paymentId), deleted ? isNull(khPayment.deletedAt) : isNotNull(khPayment.deletedAt)))
			.returning();
		if (!payment) {
			throw deleted
				? ruleError("FORBIDDEN", "Kharcha: in the trash", m.kharcha_error_in_trash())
				: ruleError("FORBIDDEN", "Kharcha: not in the trash", m.kharcha_error_not_in_trash());
		}
		await writeLedger(tx, { payment });
		if (payment.groupId) await assertFormerSettled(tx, payment.groupId);
		await recordActivity(tx, me.personId, scopeOf(payment), {
			kind: deleted ? "payment.deleted" : "payment.restored",
			paymentId: payment.id,
		});
		await bumpRevs(tx, await touched(tx, payment.groupId, [me.personId, payment.fromPerson, payment.toPerson]));
		const editable = access.can.delete || access.can.restore;
		return paymentView(tx, me, {
			...access,
			payment,
			can: { edit: editable && !deleted, delete: editable && !deleted, restore: editable && deleted },
		});
	});
}

export const deletePayment = (services: KharchaServices, paymentId: string, now?: Date) =>
	setDeleted(services, paymentId, true, now);

export const restorePayment = (services: KharchaServices, paymentId: string, now?: Date) =>
	setDeleted(services, paymentId, false, now);
