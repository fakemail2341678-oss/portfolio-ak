import "@tanstack/react-start/server-only";
import { and, eq, gt, gte, ilike, inArray, isNull, lt, lte, not, or, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { FieldTerm, QueryTerm, SpendQuery } from "@/features/kharcha/spend/query/ast";
import { dateRange, parseQueryAmount, parseQueryCurrency, usableTerms } from "@/features/kharcha/spend/query/check";
import { CURRENCIES, minorDigits } from "@/lib/i18n/currency";
import type { IsoDate } from "@/lib/i18n/date-only";
import { likePattern } from "@/server/db/list";
import {
	attachment,
	khCategory,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khFriend,
	khGroup,
	khLedger,
	khMethod,
	khPayment,
	khPerson,
	khShareTag,
	khTag,
} from "@/server/db/schema";
import { EXPENSE_RECEIPTS } from "../receipts/service";

/**
 * Spend's compiler (Task 93, decision 0287): the search language's terms become Drizzle
 * SQL for the two kinds of row Spend lists, the caller's share of an expense (`expense`,
 * over `kh_expense` joined to their `kh_expense_share`) and a payment they made or got
 * (`payment`, over `kh_payment`). Every field is a case of the switch below (the allow-list:
 * anything else never reaches SQL), every value is a bound parameter, and the only raw SQL
 * is a comparison operator taken from a fixed map. A term that can't be used (`termProblem`)
 * is left out, as the bar shows. Names (`category:food`, `with:asha`) are matched among the
 * caller's own lists and people, in any case.
 */

export type CompileContext = {
	personId: string;
	/** Today in the caller's time zone: what `date:this-month` means. */
	today: IsoDate;
	/** The caller's expenses that may be duplicates (`duplicateIdsOf`), when the query has `is:duplicate`. */
	duplicateIds: ReadonlyArray<string>;
};

/** Where clauses for both kinds of row; `payment` is null when the query leaves payments out. */
export type CompiledQuery = { expense: SQL; payment: SQL | null };

type Pair = { expense: SQL; payment: SQL };

const TRUE = sql`true`;
const FALSE = sql`false`;
const expenseOnly = (condition: SQL): Pair => ({ expense: condition, payment: FALSE });

const anyOf = (conditions: ReadonlyArray<SQL | undefined>): SQL => {
	const kept = conditions.filter((each): each is SQL => each !== undefined);
	return kept.length === 0 ? FALSE : kept.length === 1 ? (kept[0] ?? FALSE) : (or(...kept) ?? FALSE);
};
const allOf = (conditions: ReadonlyArray<SQL>): SQL =>
	conditions.length === 0 ? TRUE : conditions.length === 1 ? (conditions[0] ?? TRUE) : (and(...conditions) ?? TRUE);

const lowered = (values: ReadonlyArray<string>) => values.map((value) => value.trim().toLocaleLowerCase());
const lower = (column: AnyPgColumn | SQL) => sql`lower(${column})`;

/** A column's currency's minor digits, from the code's table (only codes that differ from 2 are listed). */
const digitsOf = (currency: AnyPgColumn): SQL => {
	const odd = CURRENCIES.filter((code) => minorDigits(code) !== 2);
	if (odd.length === 0) return sql`2`;
	return sql`(case ${currency} ${sql.join(
		// The digits are the code table's own integers, never input.
		odd.map((code) => sql`when ${code} then ${sql.raw(String(minorDigits(code)))}`),
		sql` `,
	)} else 2 end)`;
};

const COMPARE = { ":": "=", "=": "=", ">": ">", "<": "<", ">=": ">=", "<=": "<=" } as const;

/** `amount op value`, the value in the currency's major units: the minor amount over 10^digits, as numeric. */
function amountCompare(amount: AnyPgColumn, currency: AnyPgColumn, term: FieldTerm): SQL {
	const op = sql.raw(COMPARE[term.op]);
	return anyOf(
		term.values.map((value) => {
			const major = parseQueryAmount(value);
			return major === null
				? undefined
				: sql`(${amount}::numeric / power(10::numeric, ${digitsOf(currency)})) ${op} ${major}::numeric`;
		}),
	);
}

/** `date op value` over a calendar-day column: a range for `:`, its ends for the comparisons. */
function dateCompare(column: AnyPgColumn, term: FieldTerm, today: IsoDate): SQL {
	return anyOf(
		term.values.map((value) => {
			const range = dateRange(value, today);
			if (!range) return undefined;
			switch (term.op) {
				case ">":
					return gt(column, range.last);
				case ">=":
					return gte(column, range.first);
				case "<":
					return lt(column, range.first);
				case "<=":
					return lte(column, range.last);
				default:
					return and(gte(column, range.first), lte(column, range.last));
			}
		}),
	);
}

/**
 * Whether the person in `column` is one `values` names: "me" is the caller; anyone else by
 * their name, its first word, or the caller's nickname for them.
 */
function personNamed(column: AnyPgColumn | SQL, values: ReadonlyArray<string>, meId: string): SQL {
	const names = lowered(values).filter((value) => value !== "me");
	const me = values.some((value) => value.trim().toLowerCase() === "me") ? sql`${column} = ${meId}` : undefined;
	const others =
		names.length === 0
			? undefined
			: sql`exists (select 1 from ${khPerson} left join ${khFriend} on ${khFriend.ownerId} = ${meId} and ${khFriend.friendId} = ${khPerson.id}
				where ${khPerson.id} = ${column} and (${inArray(lower(khPerson.displayName), names)}
					or ${inArray(sql`split_part(lower(${khPerson.displayName}), ' ', 1)`, names)}
					or ${inArray(lower(khFriend.nickname), names)}))`;
	return anyOf([me, others]);
}

/** The people on an expense besides the caller: its payers and its shares. */
const othersOnExpense = (meId: string) =>
	sql`(select ${khExpenseShare.personId} as person from ${khExpenseShare} where ${khExpenseShare.expenseId} = ${khExpense.id}
		union select ${khExpensePayer.personId} from ${khExpensePayer} where ${khExpensePayer.expenseId} = ${khExpense.id}) as others
		where others.person <> ${meId}`;

const sharedWithSomeone = (meId: string) => sql`exists (select 1 from ${othersOnExpense(meId)})`;

/**
 * An expense whose debts involve the caller and someone they still owe or are owed in that
 * currency, everything between the two counted (a payment settles it).
 */
const unsettled = (meId: string) => sql`exists (
	select 1 from ${khLedger} as mine where mine.expense_id = ${khExpense.id}
		and (mine.debtor_id = ${meId} or mine.creditor_id = ${meId})
		and (select coalesce(sum(case when pair.creditor_id = ${meId} then pair.amount_minor else -pair.amount_minor end), 0)
			from ${khLedger} as pair
			where pair.currency = mine.currency
				and ((pair.creditor_id = ${meId} and pair.debtor_id = case when mine.debtor_id = ${meId} then mine.creditor_id else mine.debtor_id end)
					or (pair.debtor_id = ${meId} and pair.creditor_id = case when mine.debtor_id = ${meId} then mine.creditor_id else mine.debtor_id end))
		) <> 0)`;

/** Words → a prefix tsquery (`mom tea` → `mom:* & tea:*`); a phrase → `eating <-> out`. Only letters, marks and digits pass. */
export function tsQueryOf(value: string, phrase: boolean): string | null {
	const words = value
		.toLowerCase()
		.split(/[^\p{L}\p{M}\p{N}]+/u)
		.filter(Boolean)
		.slice(0, 8);
	if (words.length === 0) return null;
	return phrase && words.length > 1 ? words.join(" <-> ") : words.map((word) => `${word}:*`).join(" & ");
}

function textPair(term: Extract<QueryTerm, { kind: "text" }>): Pair | null {
	const query = tsQueryOf(term.value, term.quoted);
	if (!query) return null;
	return {
		expense: sql`${khExpense.search} @@ to_tsquery('simple', ${query})`,
		payment: ilike(khPayment.note, likePattern(term.value.trim())),
	};
}

function fieldPair(term: FieldTerm, context: CompileContext): Pair {
	const me = context.personId;
	const values = lowered(term.values);
	switch (term.field) {
		case "type": {
			const kinds = values.filter((value) => value === "expense" || value === "refund");
			return {
				expense: kinds.length > 0 ? inArray(khExpense.kind, kinds) : FALSE,
				payment: values.includes("payment") ? TRUE : FALSE,
			};
		}
		case "category":
			return expenseOnly(
				sql`exists (select 1 from ${khCategory} where ${khCategory.id} = ${khExpenseShare.categoryId} and ${inArray(lower(khCategory.name), values)})`,
			);
		case "tag":
			return expenseOnly(
				sql`exists (select 1 from ${khShareTag} inner join ${khTag} on ${khTag.id} = ${khShareTag.tagId}
					where ${khShareTag.expenseId} = ${khExpense.id} and ${khShareTag.personId} = ${me} and ${inArray(lower(khTag.name), values)})`,
			);
		case "merchant":
			return expenseOnly(
				term.op === "="
					? inArray(lower(khExpense.merchant), values)
					: anyOf(term.values.map((value) => ilike(khExpense.merchant, likePattern(value.trim())))),
			);
		case "amount":
			return {
				expense: amountCompare(khExpense.amountMinor, khExpense.currency, term),
				payment: amountCompare(khPayment.amountMinor, khPayment.currency, term),
			};
		case "currency": {
			const codes = term.values.flatMap((value) => parseQueryCurrency(value) ?? []);
			return { expense: inArray(khExpense.currency, codes), payment: inArray(khPayment.currency, codes) };
		}
		case "date":
			return {
				expense: dateCompare(khExpense.spentOn, term, context.today),
				payment: dateCompare(khPayment.paidOn, term, context.today),
			};
		case "group": {
			const named = sql`(select ${khGroup.id} from ${khGroup} where ${inArray(lower(khGroup.name), values)})`;
			return {
				expense: sql`${khExpense.groupId} in ${named}`,
				payment: sql`${khPayment.groupId} in ${named}`,
			};
		}
		case "with":
			return {
				expense: sql`exists (select 1 from ${othersOnExpense(me)} and ${personNamed(sql`others.person`, term.values, me)})`,
				payment: personNamed(
					sql`(case when ${khPayment.fromPerson} = ${me} then ${khPayment.toPerson} else ${khPayment.fromPerson} end)`,
					term.values,
					me,
				),
			};
		case "paid-by":
			return {
				expense: sql`exists (select 1 from ${khExpensePayer} where ${khExpensePayer.expenseId} = ${khExpense.id}
					and ${personNamed(khExpensePayer.personId, term.values, me)})`,
				payment: personNamed(khPayment.fromPerson, term.values, me),
			};
		case "method":
			return {
				expense: sql`exists (select 1 from ${khExpensePayer} inner join ${khMethod} on ${khMethod.id} = ${khExpensePayer.methodId}
					where ${khExpensePayer.expenseId} = ${khExpense.id} and ${khExpensePayer.personId} = ${me} and ${inArray(lower(khMethod.name), values)})`,
				payment: inArray(lower(khPayment.method), values),
			};
		case "has":
			return expenseOnly(
				sql`exists (select 1 from ${attachment} where ${attachment.entityType} = ${EXPENSE_RECEIPTS}
					and ${attachment.entityId} = ${khExpense.id}::text and ${isNull(attachment.deletedAt)})`,
			);
		case "is":
			return {
				expense: anyOf(
					values.map((value) => {
						switch (value) {
							case "shared":
								return sharedWithSomeone(me);
							case "personal":
								return not(sharedWithSomeone(me));
							case "unsettled":
								return unsettled(me);
							case "duplicate":
								return context.duplicateIds.length > 0 ? inArray(khExpense.id, [...context.duplicateIds]) : FALSE;
							case "uncategorized":
								return and(gt(khExpenseShare.owedMinor, 0), isNull(khExpenseShare.categoryId));
							default:
								return undefined;
						}
					}),
				),
				payment: FALSE,
			};
	}
}

const termPair = (term: QueryTerm, context: CompileContext): Pair | null => {
	const pair = term.kind === "text" ? textPair(term) : fieldPair(term, context);
	if (!pair || !term.negated) return pair;
	return { expense: not(pair.expense), payment: not(pair.payment) };
};

/** Whether the query has `is:duplicate` (in any form): only then are the caller's duplicates looked for. */
export const asksDuplicates = (terms: SpendQuery) =>
	terms.some(
		(term) => term.kind === "field" && term.field === "is" && term.values.some((v) => v.toLowerCase() === "duplicate"),
	);

/**
 * The query's where clauses. Payments are listed only when a `type:` term names them
 * (Spend is spending); every other term must hold for a row of either kind.
 */
export function compileQuery(query: SpendQuery, context: CompileContext): CompiledQuery {
	const terms = usableTerms(query);
	const pairs = terms.flatMap((term) => termPair(term, context) ?? []);
	const wantsPayments = terms.some(
		(term) =>
			term.kind === "field" && term.field === "type" && !term.negated && lowered(term.values).includes("payment"),
	);
	return {
		expense: allOf([
			eq(khExpenseShare.personId, context.personId),
			isNull(khExpense.deletedAt),
			...pairs.map((pair) => pair.expense),
		]),
		payment: wantsPayments
			? allOf([
					or(eq(khPayment.fromPerson, context.personId), eq(khPayment.toPerson, context.personId)) ?? FALSE,
					isNull(khPayment.deletedAt),
					...pairs.map((pair) => pair.payment),
				])
			: null,
	};
}
