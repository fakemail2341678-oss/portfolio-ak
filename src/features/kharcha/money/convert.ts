/**
 * A payment in another currency (PLAN 14.5 "Across currencies", decision 0285): what an
 * amount comes to at the rate the payer typed. The debt is settled in its own currency;
 * this only says what was handed over, and the server checks it with the same function.
 *
 * Integers in minor units only, through BigInt. This file imports nothing at run time
 * (see ./split.ts), so the digits of each currency are passed in.
 */

/**
 * `amountMinor` of a currency with `fromDigits` minor digits, at `rate` units of the other
 * currency for one unit of it, in the other's minor units (`toDigits`), rounded half up.
 * `rate` is a decimal string (`RATE_PATTERN` in ../schema.ts: up to 9 digits and 8 decimals).
 */
export function convertAt(amountMinor: number, fromDigits: number, toDigits: number, rate: string): number {
	const [whole = "0", fraction = ""] = rate.split(".");
	const rateUnits = BigInt(`${whole}${fraction}` || "0");
	const numerator = BigInt(amountMinor) * rateUnits * 10n ** BigInt(toDigits);
	const denominator = 10n ** BigInt(fraction.length + fromDigits);
	return Number((numerator * 2n + denominator) / (2n * denominator));
}
