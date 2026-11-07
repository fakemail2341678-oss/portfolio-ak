import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { type Answer, type Answers, type FormField, isAnswered, RATING_MAX } from "./fields";
import { type FieldResult, LATEST_ANSWERS } from "./types";

/**
 * Forms' results (decision 0195), computed from the stored answers: counts per option
 * for choices, the average and distribution for ratings, average and range for
 * numbers, agreement for consent, and the newest answers for text. Answers that no
 * longer fit their field (an option since removed, a value of another type) are
 * left out rather than miscounted.
 */
export function summarize(fields: ReadonlyArray<FormField>, responses: ReadonlyArray<Answers>): FieldResult[] {
	return fields.map((field) => {
		const values = responses.map((answers) => answers[field.id]).filter(isAnswered);
		switch (field.type) {
			case "single_select":
			case "multi_select": {
				const counts = new Map(field.options.map((option) => [option.id, 0]));
				let answered = 0;
				for (const value of values) {
					const picked = (Array.isArray(value) ? value : [value]).filter(
						(id): id is string => typeof id === "string" && counts.has(id),
					);
					if (picked.length === 0) continue;
					answered++;
					for (const id of picked) counts.set(id, (counts.get(id) ?? 0) + 1);
				}
				return {
					kind: "choice",
					fieldId: field.id,
					answered,
					counts: field.options.map((option) => ({ optionId: option.id, count: counts.get(option.id) ?? 0 })),
				};
			}
			case "rating": {
				const ratings = values.filter(
					(value): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= RATING_MAX,
				);
				const counts = Array.from({ length: RATING_MAX }, (_, index) => ratings.filter((r) => r === index + 1).length);
				return { kind: "rating", fieldId: field.id, answered: ratings.length, average: mean(ratings), counts };
			}
			case "number": {
				const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
				return {
					kind: "number",
					fieldId: field.id,
					answered: numbers.length,
					average: mean(numbers),
					min: numbers.length ? Math.min(...numbers) : null,
					max: numbers.length ? Math.max(...numbers) : null,
				};
			}
			case "consent": {
				const booleans = values.filter((value): value is boolean => typeof value === "boolean");
				return {
					kind: "consent",
					fieldId: field.id,
					answered: booleans.length,
					agreed: booleans.filter(Boolean).length,
				};
			}
			default: {
				const texts = values.filter((value): value is string => typeof value === "string");
				return { kind: "text", fieldId: field.id, answered: texts.length, latest: texts.slice(0, LATEST_ANSWERS) };
			}
		}
	});
}

const mean = (values: ReadonlyArray<number>) =>
	values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

/** An answer as text, in the page's language: option labels, formatted numbers and dates, Yes or No. */
export function answerText(field: FormField, value: Answer | undefined): string {
	if (!isAnswered(value)) return "";
	switch (field.type) {
		case "single_select":
		case "multi_select": {
			const ids = Array.isArray(value) ? value : [String(value)];
			return ids
				.map((id) => field.options.find((option) => option.id === id)?.label)
				.filter((label): label is string => Boolean(label))
				.join(", ");
		}
		case "number":
		case "rating":
			return typeof value === "number" ? formatNumber(value) : "";
		case "date":
			return typeof value === "string" ? formatDate(isoDateInstant(value), { dateStyle: "medium" }) : "";
		case "consent":
			return value === true ? m.forms_answer_yes() : m.forms_answer_no();
		default:
			return typeof value === "string" ? value : "";
	}
}

/** An answer for the CSV file: like answerText, but dates and numbers as written (other programs read them). */
export function answerCsv(field: FormField, value: Answer | undefined): string {
	if (!isAnswered(value)) return "";
	if ((field.type === "number" || field.type === "rating") && typeof value === "number") return String(value);
	if (field.type === "date" && typeof value === "string") return value;
	return answerText(field, value);
}
