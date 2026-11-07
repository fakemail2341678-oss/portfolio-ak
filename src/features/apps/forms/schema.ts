import { z } from "zod";
import { versionSchema } from "@/lib/concurrency";
import { optionalText, required } from "@/lib/validation";
import { formFieldsSchema } from "./fields";
import { FORM_SLUG_PATTERN } from "./search";

/**
 * Forms' inputs (decision 0195), checked on the server and by the builder. Ids of new
 * forms come from the browser (`crypto.randomUUID()`); the slug of the public page is
 * made by the server.
 */
const id = z.uuid();

export const FORM_TITLE_MAX = 120;
export const FORM_DESCRIPTION_MAX = 1000;

export const createFormInput = z.strictObject({ id, title: required({ max: FORM_TITLE_MAX }) });

/** The builder's save: the whole definition, against the version it was loaded at. */
export const saveFormInput = z.strictObject({
	id,
	updatedAt: versionSchema(),
	title: required({ max: FORM_TITLE_MAX }),
	description: optionalText({ max: FORM_DESCRIPTION_MAX }),
	fields: formFieldsSchema(),
});

export const formIdInput = z.strictObject({ id });

export const setFormStatusInput = z.strictObject({ id, status: z.enum(["draft", "published"]) });

export const formResultsInput = z.strictObject({ id, page: z.number().int().min(1).max(1000) });

export const formSlugInput = z.strictObject({ slug: z.string().regex(FORM_SLUG_PATTERN) });

/**
 * A respondent's submission: the answers (checked against the form's own schema on
 * the server, `toZodSchema`), the honeypot and Turnstile's token.
 */
export const submitResponseInput = z.strictObject({
	slug: z.string().regex(FORM_SLUG_PATTERN),
	answers: z.record(z.string().max(16), z.unknown()),
	website: z.string().max(200).optional(),
	captcha: z.string().max(4096).optional(),
});

export type CreateFormInput = z.infer<typeof createFormInput>;
export type SaveFormInput = z.infer<typeof saveFormInput>;
export type SetFormStatusInput = z.infer<typeof setFormStatusInput>;
export type SubmitResponseInput = z.infer<typeof submitResponseInput>;
