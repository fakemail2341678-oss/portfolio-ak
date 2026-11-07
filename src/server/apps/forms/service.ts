import "@tanstack/react-start/server-only";
import {
	type Answers,
	compactAnswers,
	type FormField,
	newFieldId,
	newOptionId,
	toZodSchema,
} from "@/features/apps/forms/fields";
import { summarize } from "@/features/apps/forms/results";
import type {
	CreateFormInput,
	SaveFormInput,
	SetFormStatusInput,
	SubmitResponseInput,
} from "@/features/apps/forms/schema";
import {
	FORM_RESPONSE_LIMIT,
	FORMS_QUOTAS,
	type FormDetail,
	type FormResponse,
	type FormResults,
	type FormsList,
	type PublicForm,
	RESPONSES_PAGE_SIZE,
} from "@/features/apps/forms/types";
import { AppError, ruleError, zodFieldErrors } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import type { AppServices } from "@/server/apps/ownership";
import { notFound } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import type { FormRow } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import * as repo from "./repository";

/**
 * Forms' rules (decision 0195): every call of the app acts on the caller's own forms
 * (the repository scopes by owner) under a quota; only an account publishes (a
 * guest's form is never public, 0186); the public page shows a published form by its
 * random slug, and a submission passes a honeypot, Turnstile when configured, a rate
 * limit per sender and the form's own schema (`toZodSchema`) before it is stored.
 * Not audited: app data isn't an admin action (0186).
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const randomSlug = () =>
	Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) => ALPHABET[byte % ALPHABET.length]).join("");

async function freeSlug(tx: Tx): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const slug = randomSlug();
		if (!(await repo.slugTaken(tx, slug))) return slug;
	}
	throw new Error("No free form slug after 5 attempts");
}

const toDetail = (row: FormRow, responses: number): FormDetail => ({
	id: row.id,
	slug: row.slug,
	title: row.title,
	description: row.description,
	fields: row.fields,
	status: row.status,
	responses,
	updatedAt: row.updatedAt.toISOString(),
});

export async function listForms({ db, user }: AppServices, now = new Date()): Promise<FormsList> {
	const rows = await repo.listForms(db, user.id);
	const forms = rows.map((row) => ({
		id: row.id,
		slug: row.slug,
		title: row.title,
		status: row.status,
		fieldCount: row.fields.length,
		responses: row.responses,
		updatedAt: row.updatedAt.toISOString(),
	}));
	return { forms, now: now.toISOString() };
}

export async function getForm({ db, user }: AppServices, id: string): Promise<FormDetail> {
	const row = await repo.getForm(db, user.id, id);
	if (!row) throw notFound("Form");
	return toDetail(row, await repo.countResponses(db, id));
}

export async function createForm({ db, user }: AppServices, input: CreateFormInput): Promise<FormDetail> {
	return db.transaction(async (tx) => {
		await lockQuota(tx, `forms:${user.id}`);
		if ((await repo.countForms(tx, user.id)) >= FORMS_QUOTAS.forms) {
			throw ruleError("CONFLICT", "Forms quota reached", m.forms_quota({ max: formatNumber(FORMS_QUOTAS.forms) }));
		}
		const row = await repo.insertForm(tx, user.id, { id: input.id, title: input.title, slug: await freeSlug(tx) });
		return toDetail(row, 0);
	});
}

export async function saveForm(
	{ db, user }: AppServices,
	{ id, updatedAt, ...set }: SaveFormInput,
): Promise<FormDetail> {
	return db.transaction(async (tx) => {
		const row = await repo.saveForm(tx, user.id, id, updatedAt, set);
		if (!row) throw notFound("Form");
		return toDetail(row, await repo.countResponses(tx, id));
	});
}

/** Publishes (an account's form with a question at least) or takes the form down. */
export async function setFormStatus({ db, user }: AppServices, { id, status }: SetFormStatusInput): Promise<void> {
	if (status === "published" && user.isGuest) {
		throw ruleError("FORBIDDEN", "Guests can't publish forms", m.forms_publish_guest());
	}
	await db.transaction(async (tx) => {
		const current = await repo.getForm(tx, user.id, id);
		if (!current) throw notFound("Form");
		if (status === "published" && current.fields.length === 0) {
			throw ruleError("BAD_REQUEST", "No questions to publish", m.forms_publish_empty());
		}
		await repo.setStatus(tx, user.id, id, status);
	});
}

export async function deleteForm({ db, user }: AppServices, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await repo.deleteForm(tx, user.id, id))) throw notFound("Form");
	});
}

/** The results page: every field's numbers from every response, and one page of responses. */
export async function getResults({ db, user }: AppServices, id: string, page: number): Promise<FormResults> {
	const row = await repo.getForm(db, user.id, id);
	if (!row) throw notFound("Form");
	const all = await repo.responses(db, user.id, id);
	const pageCount = Math.max(1, Math.ceil(all.length / RESPONSES_PAGE_SIZE));
	const current = Math.min(page, pageCount);
	return {
		form: { id: row.id, slug: row.slug, title: row.title, status: row.status, fields: row.fields },
		total: all.length,
		results: summarize(
			row.fields,
			all.map((response) => response.data),
		),
		responses: all.slice((current - 1) * RESPONSES_PAGE_SIZE, current * RESPONSES_PAGE_SIZE).map(toResponse),
		page: current,
		pageCount,
	};
}

const toResponse = (row: { id: string; data: Answers; submittedAt: Date }): FormResponse => ({
	id: row.id,
	answers: row.data,
	submittedAt: row.submittedAt.toISOString(),
});

/** Every response, for the CSV file (the browser writes it with the field labels). */
export async function exportResponses({ db, user }: AppServices, id: string): Promise<FormResponse[]> {
	if (!(await repo.getForm(db, user.id, id))) throw notFound("Form");
	return (await repo.responses(db, user.id, id)).map(toResponse);
}

// ---------------------------------------------------------------------------
// The public page and its submissions
// ---------------------------------------------------------------------------

/** A published form for /f/$slug; a draft, a guest's or no such form is the same NOT_FOUND. */
export async function getPublicForm({ db }: { db: Db }, slug: string): Promise<PublicForm> {
	const row = await repo.findPublished(db, slug);
	if (!row) throw notFound("Form");
	return { slug: row.slug, title: row.title, description: row.description, fields: row.fields };
}

export type ResponseClient = {
	/** A keyed hash of the sender's IP (never the IP itself), or null when unknown. */
	ipHash: string | null;
	/** Turnstile's check, when it is configured. */
	verifyCaptcha: ((token: string | undefined) => Promise<boolean>) | null;
};

/**
 * A respondent's answers: the honeypot (a filled one gets the same "sent" answer and
 * stores nothing, so bots learn nothing), Turnstile, a rate limit per sender and
 * form, the same questions as the page that sent them (a CONFLICT asks to reload when
 * they changed), the form's own schema (its problems come back per field, keyed by field id),
 * and a cap on responses per form.
 */
export async function submitResponse(
	{ db }: { db: Db },
	{ slug, answers, website, captcha }: SubmitResponseInput,
	client: ResponseClient,
): Promise<{ sent: true }> {
	if (website) return { sent: true };
	if (client.verifyCaptcha && !(await client.verifyCaptcha(captcha))) {
		throw ruleError("BAD_REQUEST", "Captcha failed", m.auth_error_captcha());
	}
	const row = await repo.findPublished(db, slug);
	if (!row) throw notFound("Form");
	await enforceRateLimit(db, `forms-response:${row.id}:${client.ipHash ?? "unknown"}`, FORM_RESPONSE_LIMIT);
	// The page sends every question's answer by id: other ids mean the questions changed
	// since it loaded (or a forged request). Say so, rather than errors on questions it
	// doesn't show.
	const ids = new Set(row.fields.map((field) => field.id));
	const keys = Object.keys(answers);
	if (keys.length !== ids.size || keys.some((key) => !ids.has(key))) {
		throw ruleError("CONFLICT", "The form's questions changed", m.forms_error_changed());
	}
	const parsed = toZodSchema(row.fields).safeParse(answers);
	if (!parsed.success) {
		throw new AppError("BAD_REQUEST", "Invalid answers", { fieldErrors: zodFieldErrors(parsed.error) });
	}
	await db.transaction(async (tx) => {
		// Respondents of one form wait for each other here, so the cap holds under concurrency.
		await lockQuota(tx, `forms-responses:${row.id}`);
		if ((await repo.countResponses(tx, row.id)) >= FORMS_QUOTAS.responsesPerForm) {
			throw ruleError("CONFLICT", "Responses quota reached", m.forms_responses_full());
		}
		await repo.insertResponses(tx, row.ownerId, row.id, [{ data: compactAnswers(parsed.data), ipHash: client.ipHash }]);
	});
	return { sent: true };
}

// ---------------------------------------------------------------------------
// Guests and /admin/apps
// ---------------------------------------------------------------------------

/**
 * A new guest's sample survey (decision 0186), in the language they started in: six
 * kinds of question and twelve responses over the last fortnight, so the results
 * page has charts, averages and text to show. It stays a draft: a guest's form is
 * never public, and an account publishes it after signing up.
 */
export async function seedForms(tx: Tx, userId: string, locale: Locale, now = new Date()): Promise<void> {
	const t = { locale };
	const option = (label: string) => ({ id: newOptionId(), label });
	const rating = { id: newFieldId(), type: "rating" as const };
	const heard = [
		option(m.forms_seed_heard_friends({}, t)),
		option(m.forms_seed_heard_social({}, t)),
		option(m.forms_seed_heard_passing({}, t)),
	];
	const ordered = [
		option(m.forms_seed_order_tea({}, t)),
		option(m.forms_seed_order_coffee({}, t)),
		option(m.forms_seed_order_momo({}, t)),
		option(m.forms_seed_order_cake({}, t)),
	];
	const fields: FormField[] = [
		{
			...rating,
			label: m.forms_seed_rating({}, t),
			help: "",
			required: true,
			lowLabel: m.forms_seed_rating_low({}, t),
			highLabel: m.forms_seed_rating_high({}, t),
		},
		{
			id: newFieldId(),
			type: "single_select",
			label: m.forms_seed_heard({}, t),
			help: "",
			required: false,
			options: heard,
			display: "radio",
		},
		{
			id: newFieldId(),
			type: "multi_select",
			label: m.forms_seed_order({}, t),
			help: m.forms_seed_order_help({}, t),
			required: false,
			options: ordered,
			maxChoices: null,
		},
		{
			id: newFieldId(),
			type: "long_text",
			label: m.forms_seed_better({}, t),
			help: "",
			required: false,
			maxLength: 2000,
		},
		{ id: newFieldId(), type: "email", label: m.forms_seed_email({}, t), help: "", required: false },
	];
	const [, heardField, orderField, betterField] = fields;
	const row = await repo.insertForm(tx, userId, {
		slug: await freeSlug(tx),
		title: m.forms_seed_title({}, t),
		description: m.forms_seed_description({}, t),
		fields,
		createdAt: new Date(now.getTime() - 14 * 86_400_000),
	});
	const comments = [m.forms_seed_comment_1({}, t), m.forms_seed_comment_2({}, t), m.forms_seed_comment_3({}, t)];
	const ratings = [5, 4, 5, 3, 4, 5, 2, 4, 5, 4, 3, 5];
	const responses = ratings.map((value, index) => {
		const data: Answers = { [rating.id]: value };
		if (heardField && index % 4 !== 3) data[heardField.id] = heard[index % heard.length]?.id ?? "";
		if (orderField) data[orderField.id] = ordered.filter((_, at) => (index + at) % 3 !== 0).map((each) => each.id);
		if (betterField && index % 4 === 0) data[betterField.id] = comments[(index / 4) % comments.length] ?? "";
		return { data, submittedAt: new Date(now.getTime() - (index + 1) * 26 * 3_600_000) };
	});
	await repo.insertResponses(tx, userId, row.id, responses);
}

export const claimForms = (tx: Tx, fromUserId: string, toUserId: string) =>
	repo.transferForms(tx, fromUserId, toUserId);

export const formsUsage = repo.formsUsage;
