import "@tanstack/react-start/server-only";
import { and, asc, count, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { computeShares } from "@/features/kharcha/money/split";
import { threadKey } from "@/features/kharcha/notifications";
import {
	beforeEnd,
	type Cadence,
	dueOccurrences,
	firstOnOrAfter,
	occurrenceOn,
	type RecurringUnit,
} from "@/features/kharcha/recurring/cadence";
import type { RepeatExpenseInput, UpdateRecurringInput } from "@/features/kharcha/schema";
import type { RecurringProblem, RecurringTemplate, RecurringView } from "@/features/kharcha/types";
import { AppError, ruleError } from "@/lib/errors";
import { addDays, type IsoDate, todayInZone } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { notFound } from "@/server/db/crud";
import {
	type KhRecurringRow,
	khExpense,
	khGroup,
	khPerson,
	khProfile,
	khRecurring,
	user as userTable,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import { assertSourceCan, type KharchaServices, type Me, resolveExpense, resolveMe } from "../access";
import * as repo from "../expenses/repository";
import { addCheckedExpense, type CheckedExpense } from "../expenses/service";
import { chipsOf } from "../lists/repository";
import { produce } from "../notify/produce";
import { loadPeople } from "../people";
import { bumpRevs, saveVersioned } from "../rev";
import { assertQuota, getSettings, quotasFor } from "../settings";

/**
 * Recurring expenses (Task 94, decision 0288; docs/guides/kharcha.md "Recurring
 * expenses"): "Repeat…" on an expense keeps it as a template (what it is, who paid, the
 * split, the caller's own category, method and tags), and the daily job makes it again on
 * each occurrence's day in the owner's time zone, catching up on days it missed, each
 * occurrence once (`kh_expense` is unique on the recurring id and the occurrence's
 * number). A recurring expense is its owner's: another's is NOT_FOUND, even for someone on
 * the expenses it makes. What can't be made any more (they left the group, a friend is no
 * friend, a quota) pauses it with the reason.
 */

type Conn = Db | Tx;

const cadenceOf = (row: Pick<KhRecurringRow, "unit" | "every">): Cadence => ({ unit: row.unit, every: row.every });

async function zoneOf(db: Conn, userId: string): Promise<string> {
	const [row] = await db.select({ timeZone: khProfile.timeZone }).from(khProfile).where(eq(khProfile.userId, userId));
	return row?.timeZone ?? "UTC";
}

/** The person's recurring expenses, next due first (paused and ended ones last). */
export async function recurringViews(db: Conn, personId: string): Promise<RecurringView[]> {
	const rows = await db
		.select({ recurring: khRecurring, group: { id: khGroup.id, name: khGroup.name } })
		.from(khRecurring)
		.leftJoin(khGroup, eq(khGroup.id, khRecurring.groupId))
		.where(eq(khRecurring.ownerId, personId))
		.orderBy(asc(khRecurring.nextOn), asc(khRecurring.createdAt));
	if (rows.length === 0) return [];
	const made = await db
		.select({ id: khExpense.recurringId, n: count() })
		.from(khExpense)
		.where(
			and(
				inArray(
					khExpense.recurringId,
					rows.map((row) => row.recurring.id),
				),
				isNull(khExpense.deletedAt),
			),
		)
		.groupBy(khExpense.recurringId);
	const people = await loadPeople(
		db,
		personId,
		rows.flatMap(({ recurring }) => peopleOf(recurring.template)),
	);
	const chips = await chipsOf(
		db,
		rows.map((row) => row.recurring.template.categoryId),
	);
	const views = rows.map(({ recurring, group }): RecurringView => {
		const { template } = recurring;
		const shares = sharesOf(template);
		return {
			id: recurring.id,
			kind: template.kind,
			title: template.title,
			merchant: template.merchant,
			amountMinor: template.amountMinor,
			currency: template.currency,
			myShareMinor: shares.find((share) => share.person === personId)?.owed ?? 0,
			group: group ? { id: group.id, name: group.name } : null,
			people: people.filter((person) => !person.isMe && peopleOf(template).includes(person.id)),
			category: template.categoryId ? (chips.get(template.categoryId) ?? null) : null,
			unit: recurring.unit,
			every: recurring.every,
			startsOn: recurring.startsOn,
			nextOn: recurring.nextOn,
			endsOn: recurring.endsOn,
			ended: !beforeEnd(recurring.nextOn, recurring.endsOn),
			paused: recurring.pausedAt !== null,
			problem: recurring.problem,
			lastMadeOn: recurring.lastMadeOn,
			made: made.find((row) => row.id === recurring.id)?.n ?? 0,
			version: recurring.version,
		};
	});
	const rank = (view: RecurringView) => (view.ended ? 2 : view.paused ? 1 : 0);
	return views.sort((a, b) => rank(a) - rank(b));
}

/** The shares the template's split gives (it was checked when it was kept; one that no longer adds up shows none). */
function sharesOf(template: RecurringTemplate) {
	const result = computeShares(template.amountMinor, template.split);
	return result.ok ? result.shares : [];
}

const peopleOf = (template: RecurringTemplate): string[] =>
	repo.partsPeople({ payers: template.payers, shares: sharesOf(template) });

/** Settings → Recurring: the caller's. */
export async function listRecurring({ db, user }: KharchaServices): Promise<RecurringView[]> {
	const me = await resolveMe(db, user);
	return recurringViews(db, me.personId);
}

async function ownRecurring(tx: Tx, me: Me, id: string): Promise<KhRecurringRow> {
	const [row] = await tx
		.select()
		.from(khRecurring)
		.where(and(eq(khRecurring.id, id), eq(khRecurring.ownerId, me.personId)))
		.for("update");
	if (!row) throw notFound("Recurring expense");
	return row;
}

async function change({ db, user }: KharchaServices, work: (tx: Tx, me: Me, today: IsoDate) => Promise<void>) {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const today = todayInZone(await zoneOf(tx, user.id));
		await work(tx, me, today);
		await bumpRevs(tx, [me.personId]);
		return recurringViews(tx, me.personId);
	});
}

/** The first occurrence after both its own day and today: nothing is made for days already gone. */
const nextAfter = (startsOn: IsoDate, cadence: Cadence, today: IsoDate) =>
	firstOnOrAfter(startsOn, cadence, addDays(startsOn > today ? startsOn : today, 1));

/**
 * "Repeat…": the expense becomes occurrence 0 of a new recurring expense, made again every
 * `every` units from its day. Anyone who could edit the expense may (it names only people
 * they can name), with the caller's own category, method and tags on what it makes.
 */
export const repeatExpense = (services: KharchaServices, input: RepeatExpenseInput) =>
	change(services, async (tx, me, today) => {
		const access = await resolveExpense(tx, me, input.expenseId);
		assertSourceCan(access, "edit");
		const { expense } = access;
		if (expense.recurringId) {
			throw ruleError("CONFLICT", "Kharcha: already recurring", m.kharcha_error_already_recurring());
		}
		const settings = await getSettings(tx);
		await assertQuota(tx, `${me.personId}:recurring`, {
			table: khRecurring,
			where: eq(khRecurring.ownerId, me.personId),
			max: quotasFor(settings, me).recurring,
		});
		const parts = await repo.partsOf(tx, expense.id);
		const mine = (await repo.minesOf(tx, me.personId, [expense.id])).get(expense.id);
		const cadence: Cadence = { unit: input.unit as RecurringUnit, every: input.every ?? 1 };
		const next = nextAfter(expense.spentOn, cadence, today);
		const template: RecurringTemplate = {
			kind: expense.kind,
			title: expense.title,
			merchant: expense.merchant,
			notes: expense.notes,
			amountMinor: expense.amountMinor,
			currency: expense.currency,
			payers: parts.payers,
			split: expense.split,
			categoryId: mine?.categoryId ?? null,
			methodId: mine?.methodId ?? null,
			tagIds: mine?.tagIds ?? [],
		};
		const [row] = await tx
			.insert(khRecurring)
			.values({
				ownerId: me.personId,
				groupId: expense.groupId,
				template,
				unit: cadence.unit,
				every: cadence.every,
				startsOn: expense.spentOn,
				nextN: next.n,
				nextOn: next.on,
				endsOn: input.endsOn ?? null,
			})
			.returning({ id: khRecurring.id });
		if (!row) throw new Error("kh_recurring: nothing inserted");
		await tx.update(khExpense).set({ recurringId: row.id, recurringN: 0 }).where(eq(khExpense.id, expense.id));
	});

/**
 * A new cadence or end. A new cadence counts from the last one made (else the first) and
 * starts after today; the expenses' numbers (`seq`) carry on, so none is made twice.
 */
export const updateRecurring = (services: KharchaServices, input: UpdateRecurringInput) =>
	change(services, async (tx, me, today) => {
		const row = await ownRecurring(tx, me, input.recurringId);
		const cadence: Cadence = { unit: input.unit as RecurringUnit, every: input.every ?? 1 };
		const changed = cadence.unit !== row.unit || cadence.every !== row.every;
		const anchor = row.lastMadeOn ?? row.startsOn;
		const next = changed ? nextAfter(anchor, cadence, today) : null;
		await saveVersioned(tx, khRecurring, {
			id: row.id,
			version: input.version,
			set: {
				unit: cadence.unit,
				every: cadence.every,
				endsOn: input.endsOn ?? null,
				...(next ? { startsOn: anchor, nextN: next.n, nextOn: next.on } : {}),
			},
			what: "Recurring expense",
		});
	});

/** Pause, or carry on from the next occurrence after today (nothing missed while paused is made). */
export const pauseRecurring = (services: KharchaServices, input: { recurringId: string; paused: boolean }) =>
	change(services, async (tx, me, today) => {
		const row = await ownRecurring(tx, me, input.recurringId);
		if (input.paused) {
			await tx.update(khRecurring).set({ pausedAt: new Date() }).where(eq(khRecurring.id, row.id));
			return;
		}
		const next = firstOnOrAfter(row.startsOn, cadenceOf(row), today);
		const n = Math.max(next.n, row.nextN);
		await tx
			.update(khRecurring)
			.set({ pausedAt: null, problem: null, nextN: n, nextOn: occurrenceOn(row.startsOn, cadenceOf(row), n) })
			.where(eq(khRecurring.id, row.id));
	});

/** Skip the next one: it is never made. */
export const skipRecurring = (services: KharchaServices, recurringId: string) =>
	change(services, async (tx, me) => {
		const row = await ownRecurring(tx, me, recurringId);
		const n = row.nextN + 1;
		await tx
			.update(khRecurring)
			.set({ nextN: n, nextOn: occurrenceOn(row.startsOn, cadenceOf(row), n) })
			.where(eq(khRecurring.id, row.id));
	});

/** Stops it for good; the expenses it made stay. */
export const deleteRecurring = (services: KharchaServices, recurringId: string) =>
	change(services, async (tx, me) => {
		const row = await ownRecurring(tx, me, recurringId);
		await tx.delete(khRecurring).where(eq(khRecurring.id, row.id));
	});

/** Why an occurrence couldn't be made, from the refusal. */
export function problemOf(error: unknown): RecurringProblem | null {
	if (!(error instanceof AppError)) return null;
	const message = error.message;
	if (message.includes("quota")) return "quota";
	if (message.includes("currency")) return "currency";
	if (message.includes("split") || message.includes("payers")) return "split";
	if (message.includes("not a member") || message.includes("not a friend") || message.includes("isn't on")) {
		return "people";
	}
	if (/group|former member/i.test(message)) return "group";
	if (error.code === "NOT_FOUND" || error.code === "FORBIDDEN" || error.code === "BAD_REQUEST") return "people";
	return null;
}

export type RecurringRun = { made: number; paused: number; failed: number; instant: string[] };

/**
 * The daily job's step (PLAN 14.5): every recurring expense due by today in its owner's
 * time zone makes each occurrence it missed (at most `CATCH_UP_MAX` a run), as its owner,
 * through the same checks as adding an expense. One recurring expense is one transaction,
 * its row locked: a second run finds `next_n` moved on and makes nothing. One that can't be
 * made is paused with the reason and its owner told nothing more than the page says.
 */
export async function makeDueRecurring(db: Db, now = new Date()): Promise<RecurringRun> {
	const run: RecurringRun = { made: 0, paused: 0, failed: 0, instant: [] };
	// Today is at most a day ahead of UTC anywhere: anything due by tomorrow in UTC is a candidate.
	const candidates = await db
		.select({
			id: khRecurring.id,
			userId: khPerson.userId,
			guest: userTable.isAnonymous,
			timeZone: khProfile.timeZone,
		})
		.from(khRecurring)
		.innerJoin(khPerson, eq(khPerson.id, khRecurring.ownerId))
		.leftJoin(userTable, eq(userTable.id, khPerson.userId))
		.leftJoin(khProfile, eq(khProfile.userId, khPerson.userId))
		.where(
			and(
				isNull(khRecurring.pausedAt),
				lte(khRecurring.nextOn, addDays(now.toISOString().slice(0, 10), 1)),
				isNotNull(khPerson.userId),
			),
		)
		.orderBy(asc(khRecurring.nextOn));
	for (const candidate of candidates) {
		if (!candidate.userId) continue;
		const today = todayInZone(candidate.timeZone ?? "UTC", now);
		const me: Me = await resolveMe(db, {
			id: candidate.userId,
			isGuest: candidate.guest === true,
			permissions: [],
		});
		try {
			const result = await db.transaction(async (tx) => makeOne(tx, me, candidate.id, today));
			run.made += result.made;
			run.instant.push(...result.instant);
		} catch (error) {
			const problem = problemOf(error);
			if (!problem) {
				run.failed += 1;
				log("error", "kharcha daily job: a recurring expense failed", { id: candidate.id, ...errorFields(error) });
				continue;
			}
			await db.transaction(async (tx) => {
				await tx
					.update(khRecurring)
					.set({ pausedAt: now, problem })
					.where(and(eq(khRecurring.id, candidate.id), isNull(khRecurring.pausedAt)));
				await bumpRevs(tx, [me.personId]);
			});
			run.paused += 1;
		}
	}
	return run;
}

async function makeOne(tx: Tx, me: Me, recurringId: string, today: IsoDate) {
	const [row] = await tx
		.select()
		.from(khRecurring)
		.where(and(eq(khRecurring.id, recurringId), isNull(khRecurring.pausedAt)))
		.for("update");
	if (!row) return { made: 0, instant: [] };
	const due = dueOccurrences(
		{ startsOn: row.startsOn, cadence: cadenceOf(row), nextN: row.nextN, endsOn: row.endsOn },
		today,
	);
	const instant: string[] = [];
	for (const [index, occurrence] of due.entries()) {
		const { template } = row;
		const made = await addCheckedExpense(tx, me, {
			groupId: row.groupId,
			kind: template.kind,
			title: template.title,
			merchant: template.merchant,
			notes: template.notes,
			amountMinor: template.amountMinor,
			currency: template.currency as CheckedExpense["currency"],
			spentOn: occurrence.on,
			payers: template.payers,
			split: template.split,
			categoryId: template.categoryId,
			methodId: template.methodId,
			tagIds: template.tagIds,
			recurring: { id: row.id, n: row.seq + index },
		});
		instant.push(...made.instant);
		const told = await produce(tx, { personId: null, name: null }, [
			{
				kind: "recurring.made",
				to: [me.personId],
				thread: threadKey("e", made.expense.id),
				groupId: made.expense.groupId,
				expenseId: made.expense.id,
				data: { title: template.title || template.merchant },
			},
		]);
		instant.push(...told.instant);
	}
	const last = due.at(-1);
	if (last) {
		const n = last.n + 1;
		await tx
			.update(khRecurring)
			.set({
				nextN: n,
				nextOn: occurrenceOn(row.startsOn, cadenceOf(row), n),
				seq: row.seq + due.length,
				lastMadeOn: last.on,
			})
			.where(eq(khRecurring.id, row.id));
	}
	return { made: due.length, instant };
}
