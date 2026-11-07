/**
 * Nepali locale data for src/lib/i18n/intl.ts, transcribed from CLDR 47 `ne`.
 *
 * Why this exists: desktop Chrome ships reduced ICU data without Nepali, so
 * `Intl.*("ne")` silently falls back to English in the browser while Node (full
 * ICU) formats real Nepali. That breaks hydration and shows English on Nepali
 * pages. We therefore never ask ICU for `ne`. We use only data every runtime has
 * (`en-IN` grouping + the `deva` numbering system) plus the tables below.
 * tests/unit/intl.test.ts checks the output against Node's full-ICU `ne` output.
 */

/** en-IN gives lakh/crore grouping (12,34,567); nu-deva gives Devanagari digits. */
export const NE_NUMBER_LOCALE = "en-IN-u-nu-deva";

export const NE_MONTHS = [
	"जनवरी",
	"फेब्रुअरी",
	"मार्च",
	"अप्रिल",
	"मे",
	"जुन",
	"जुलाई",
	"अगस्ट",
	"सेप्टेम्बर",
	"अक्टोबर",
	"नोभेम्बर",
	"डिसेम्बर",
] as const;

/** CLDR ne abbreviated weekdays, Sunday first. */
export const NE_WEEKDAYS_SHORT = ["आइत", "सोम", "मङ्गल", "बुध", "बिहि", "शुक्र", "शनि"] as const;

/** Sunday first, matching Date#getDay(). */
export const NE_WEEKDAYS = ["आइतबार", "सोमबार", "मङ्गलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"] as const;

/** CLDR `ne` currency symbols. Currencies not listed keep their ISO code. */
export const NE_CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { NPR: "नेरू", USD: "US$", INR: "₹" };

export type NeRelativeUnit = "year" | "quarter" | "month" | "week" | "day" | "hour" | "minute" | "second";

type RelativePatterns = {
	/** `{n}` is replaced with the absolute value in Devanagari digits. */
	past: string;
	future: string;
	/** CLDR plural "one" override for the future form, when it differs. */
	futureOne?: string;
	/** `numeric: "auto"` phrases keyed by signed value. */
	words: Readonly<Record<number, string>>;
};

export const NE_RELATIVE: Readonly<Record<NeRelativeUnit, RelativePatterns>> = {
	year: { past: "{n} वर्ष अघि", future: "{n} वर्षमा", words: { [-1]: "गत वर्ष", 0: "यो वर्ष", 1: "आगामी वर्ष" } },
	quarter: {
		past: "{n}सत्र अघि",
		future: "{n}सत्रमा",
		// CLDR 47 ne really has this odd singular form.
		futureOne: "+{n} सत्रमा",
		words: { [-1]: "अघिल्लो सत्र", 0: "यो सत्र", 1: "अर्को सत्र" },
	},
	month: { past: "{n} महिना पहिले", future: "{n} महिनामा", words: { [-1]: "गत महिना", 0: "यो महिना", 1: "अर्को महिना" } },
	week: { past: "{n} हप्ता पहिले", future: "{n} हप्तामा", words: { [-1]: "गत हप्ता", 0: "यो हप्ता", 1: "आगामी हप्ता" } },
	day: {
		past: "{n} दिन पहिले",
		future: "{n} दिनमा",
		words: { [-2]: "अस्ति", [-1]: "हिजो", 0: "आज", 1: "भोलि", 2: "पर्सि" },
	},
	hour: { past: "{n} घण्टा पहिले", future: "{n} घण्टामा", words: { 0: "यस घडीमा" } },
	minute: { past: "{n} मिनेट पहिले", future: "{n} मिनेटमा", words: { 0: "यही मिनेटमा" } },
	second: { past: "{n} सेकेन्ड पहिले", future: "{n} सेकेन्डमा", words: { 0: "अहिले" } },
};

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

export const toDevanagariDigits = (value: string): string =>
	value.replace(/[0-9]/g, (digit) => DEVANAGARI_DIGITS[Number(digit)] ?? digit);
