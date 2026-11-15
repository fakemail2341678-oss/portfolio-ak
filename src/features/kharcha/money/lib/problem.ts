import { formatMoney } from "@/lib/i18n/currency";
import { m } from "@/paraglide/messages";
import type { SplitProblem } from "./split";

/**
 * Why a split or the payers can't be saved yet, in words: the split editor shows it while
 * the numbers are typed ("रु 120 left to assign"), and the server sends the same text when
 * it refuses one. Call it at render time (it reads the current language).
 */
export function splitProblemMessage(problem: SplitProblem, currency: string): string {
	switch (problem.code) {
		case "empty":
			return m.kharcha_split_empty();
		case "invalid":
			return m.kharcha_split_invalid();
		case "duplicate":
			return m.kharcha_split_duplicate();
		case "unassigned":
			return problem.left > 0
				? m.kharcha_split_left({ amount: formatMoney(problem.left, currency) })
				: m.kharcha_split_over({ amount: formatMoney(-problem.left, currency) });
		case "percent":
			return m.kharcha_split_percent();
		case "weights":
			return m.kharcha_split_weights();
		case "negative":
			return m.kharcha_split_negative();
	}
}
