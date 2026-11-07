import { z } from "zod";
import { m } from "@/paraglide/messages";

/**
 * Client-side checks for the auth forms, with localized messages. Better Auth
 * validates again on the server. (Phase 7 replaces these with the shared helpers
 * in src/lib/validation.ts.)
 */
export const PASSWORD_MIN_LENGTH = 8;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const isEmail = (value: string) => z.email().safeParse(value).success;

export const validateEmail = (value: string): string | undefined => {
	if (!value.trim()) return m.auth_error_required();
	return isEmail(value.trim()) ? undefined : m.auth_error_email();
};

export const validatePassword = (value: string): string | undefined => {
	if (!value) return m.auth_error_required();
	return value.length >= PASSWORD_MIN_LENGTH ? undefined : m.auth_error_password_length();
};

export const validateRequired = (value: string): string | undefined =>
	value.trim() ? undefined : m.auth_error_required();

export const validateConfirm = (password: string, confirm: string): string | undefined => {
	if (!confirm) return m.auth_error_required();
	return password === confirm ? undefined : m.auth_error_password_mismatch();
};

export const validateOtp = (value: string): string | undefined =>
	/^\d{6}$/.test(value.trim()) ? undefined : m.auth_error_code();

/** Removes undefined entries; returns null when every field is valid. */
export const collectErrors = <K extends string>(errors: Record<K, string | undefined>): FieldErrors<K> | null => {
	const entries = Object.entries(errors).filter((entry): entry is [K, string] => typeof entry[1] === "string");
	return entries.length ? (Object.fromEntries(entries) as FieldErrors<K>) : null;
};

/** Reads a string field from submitted form data. */
export const field = (form: FormData, name: string): string => {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
};
