import { formatMoney } from "@/lib/i18n/currency";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { ActivityValue, ExpenseActivityLine, KharchaPerson } from "../types";

/** A person starting a sentence: "You", their name, or "Someone" once they are gone. */
const who = (person: KharchaPerson | null) =>
	person ? (person.isMe ? m.kharcha_you_subject() : person.name) : m.kharcha_someone();

/** What each field of an expense is called inside a sentence of its history. */
const FIELDS: Record<string, () => string> = {
	title: () => m.kharcha_history_field_title(),
	merchant: () => m.kharcha_history_field_merchant(),
	notes: () => m.kharcha_history_field_notes(),
	amountMinor: () => m.kharcha_history_field_amount(),
	currency: () => m.kharcha_history_field_currency(),
	spentOn: () => m.kharcha_history_field_date(),
	kind: () => m.kharcha_history_field_kind(),
	category: () => m.kharcha_history_field_category(),
	tags: () => m.kharcha_history_field_tags(),
	method: () => m.kharcha_history_field_method(),
	payers: () => m.kharcha_history_field_payers(),
	split: () => m.kharcha_history_field_split(),
	receipts: () => m.kharcha_history_field_receipts(),
};

/** A value in words: an amount in the expense's currency, a day as a date, a kind by its name. */
function valueText(field: string, value: ActivityValue | undefined, currency: string): string {
	if (value === null || value === undefined || value === "") return "";
	if (field === "amountMinor" && typeof value === "number") return formatMoney(value, currency);
	if (field === "spentOn" && typeof value === "string") {
		return formatDate(isoDateInstant(value), { dateStyle: "medium", timeZone: "UTC" });
	}
	if (field === "kind") return value === "refund" ? m.kharcha_kind_refund() : m.kharcha_kind_expense();
	if (typeof value === "number") return formatNumber(value);
	return String(value);
}

/**
 * One line of an expense's history in words: "You added it", "Asha changed the amount from
 * NPR 2,380.50 to NPR 2,480.50", "You set the category to Groceries", "You changed who paid".
 */
export function historySentence(line: ExpenseActivityLine, currency: string): string {
	const actor = who(line.actor);
	switch (line.kind) {
		case "expense.created":
			return m.kharcha_history_created({ actor });
		case "expense.deleted":
			return m.kharcha_history_deleted({ actor });
		case "expense.restored":
			return m.kharcha_history_restored({ actor });
		default: {
			const field = line.data.field ?? "";
			const name = FIELDS[field]?.() ?? field;
			if (field === "payers" || field === "split") return m.kharcha_history_changed_whole({ actor, field: name });
			// An amount is shown in the currency it had: a change of currency is its own line.
			const from = valueText(field, line.data.from, currency);
			const to = valueText(field, line.data.to, currency);
			if (!from && !to) return m.kharcha_history_changed_whole({ actor, field: name });
			if (!from) return m.kharcha_history_set({ actor, field: name, to });
			if (!to) return m.kharcha_history_cleared({ actor, field: name });
			return m.kharcha_history_changed({ actor, field: name, from, to });
		}
	}
}
