/**
 * Phone number validation (libphonenumber-js rules per country). Its own module,
 * not part of validation.ts, because the metadata is about 30 kB gzip: only
 * schemas with a phone field should pull it in (decision 0151).
 */
import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";
import { m } from "@/paraglide/messages";

/** E.164 phone number ("+9779812345678"), valid for its country per libphonenumber-js. */
export const phone = (options: { optional?: boolean } = {}) => {
	const valid = z.string().refine((value) => isValidPhoneNumber(value), { error: () => m.validation_phone() });
	const text = z.string({ error: () => m.validation_required() });
	return options.optional
		? text.pipe(z.union([z.literal(""), valid]))
		: text.min(1, { error: () => m.validation_required() }).pipe(valid);
};
