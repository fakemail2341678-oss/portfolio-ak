import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FormField } from "@/features/apps/forms/fields";
import { FORM_RESPONSE_LIMIT, FORMS_QUOTAS } from "@/features/apps/forms/types";
import { isAppError } from "@/lib/errors";
import * as forms from "@/server/apps/forms/service";
import type { AppServices } from "@/server/apps/ownership";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Forms (decision 0195) on PGlite: every call of the app sees and changes only its
 * caller's forms; a save is refused against a stale version; only an account
 * publishes, and only a published account's form is public; a submission passes the
 * honeypot, Turnstile, the rate limit and the form's own schema; results, export, a
 * guest's sample survey, the claim and the usage numbers work.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) =>
		db.insert(schema.user).values([
			{ id: "alice", name: "Alice", email: "alice@example.com" },
			{ id: "bob", name: "Bob", email: "bob@example.com" },
			{ id: "guest-1", name: "Guest", email: "g1@anonymous.placeholder.invalid", isAnonymous: true },
		]),
	);
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string, isGuest = false): AppServices => ({ db: env.db, user: { id, isGuest } });
const alice = () => as("alice");
const bob = () => as("bob");
const guest = () => as("guest-1", true);
const publicServices = () => ({ db: env.db });

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		return isAppError(error) ? error.code : "thrown";
	}
};

const FIELDS: FormField[] = [
	{ id: "fname0001", type: "short_text", label: "Name", help: "", required: true, maxLength: 50 },
	{ id: "fstars001", type: "rating", label: "Visit", help: "", required: true, lowLabel: "", highLabel: "" },
	{
		id: "fdrink001",
		type: "single_select",
		label: "Drink",
		help: "",
		required: false,
		options: [
			{ id: "otea000", label: "Tea" },
			{ id: "ocoffee", label: "Coffee" },
		],
		display: "radio",
	},
];

/** A form of `services`' user with FIELDS, saved; published unless `draft`. */
async function makeForm(services: AppServices, options: { draft?: boolean } = {}) {
	const created = await forms.createForm(services, { id: crypto.randomUUID(), title: "Café" });
	const saved = await forms.saveForm(services, {
		id: created.id,
		updatedAt: created.updatedAt,
		title: "Café feedback",
		description: "A minute of your time",
		fields: FIELDS,
	});
	if (!options.draft) await forms.setFormStatus(services, { id: created.id, status: "published" });
	return saved;
}

const client = (ipHash: string | null = "hash-a") => ({ ipHash, verifyCaptcha: null });
const good = { fname0001: "Asha", fstars001: 5, fdrink001: "otea000" };
const submit = (slug: string, answers: Record<string, unknown> = good, extra: { website?: string } = {}, ip?: string) =>
	forms.submitResponse(publicServices(), { slug, answers, ...extra }, client(ip));

describe("Forms ownership", () => {
	it("never shows or changes one user's forms for another", async () => {
		const form = await makeForm(alice());
		expect((await forms.listForms(bob())).forms).toEqual([]);
		expect(await code(forms.getForm(bob(), form.id))).toBe("NOT_FOUND");
		expect(await code(forms.getResults(bob(), form.id, 1))).toBe("NOT_FOUND");
		expect(await code(forms.exportResponses(bob(), form.id))).toBe("NOT_FOUND");
		expect(
			await code(
				forms.saveForm(bob(), { id: form.id, updatedAt: form.updatedAt, title: "Mine", description: "", fields: [] }),
			),
		).toBe("NOT_FOUND");
		expect(await code(forms.setFormStatus(bob(), { id: form.id, status: "draft" }))).toBe("NOT_FOUND");
		expect(await code(forms.deleteForm(bob(), form.id))).toBe("NOT_FOUND");
		expect((await forms.getForm(alice(), form.id)).title).toBe("Café feedback");
	});

	it("lists a user's forms with their question and response counts", async () => {
		const form = await makeForm(alice());
		await submit(form.slug);
		const { forms: list } = await forms.listForms(alice());
		expect(list).toEqual([expect.objectContaining({ id: form.id, status: "published", fieldCount: 3, responses: 1 })]);
	});

	it("gives every form a random public slug of its own", async () => {
		const one = await forms.createForm(alice(), { id: crypto.randomUUID(), title: "One" });
		const two = await forms.createForm(alice(), { id: crypto.randomUUID(), title: "Two" });
		expect(one.slug).toMatch(/^[a-z0-9]{10}$/);
		expect(one.slug).not.toBe(two.slug);
	});
});

describe("Forms builder rules", () => {
	it("refuses a save against an older version (stale), and keeps the version when publishing", async () => {
		const created = await forms.createForm(alice(), { id: crypto.randomUUID(), title: "Café" });
		const input = { id: created.id, updatedAt: created.updatedAt, title: "First", description: "", fields: FIELDS };
		const saved = await forms.saveForm(alice(), input);
		expect(await code(forms.saveForm(alice(), { ...input, title: "Second" }))).toBe("CONFLICT");
		await forms.setFormStatus(alice(), { id: created.id, status: "published" });
		// Publishing isn't an edit: the builder's version still saves.
		const again = await forms.saveForm(alice(), { ...input, updatedAt: saved.updatedAt, title: "Second" });
		expect(again.title).toBe("Second");
	});

	it("caps the forms a user has", async () => {
		for (let index = 0; index < FORMS_QUOTAS.forms; index++) {
			await forms.createForm(alice(), { id: crypto.randomUUID(), title: `Form ${index}` });
		}
		expect(await code(forms.createForm(alice(), { id: crypto.randomUUID(), title: "One more" }))).toBe("CONFLICT");
	});

	it("publishes only an account's form, and only with a question", async () => {
		const empty = await forms.createForm(alice(), { id: crypto.randomUUID(), title: "Empty" });
		expect(await code(forms.setFormStatus(alice(), { id: empty.id, status: "published" }))).toBe("BAD_REQUEST");
		const guestForm = await makeForm(guest(), { draft: true });
		expect(await code(forms.setFormStatus(guest(), { id: guestForm.id, status: "published" }))).toBe("FORBIDDEN");
		// A guest may still take a form down (nothing becomes public).
		expect(await code(forms.setFormStatus(guest(), { id: guestForm.id, status: "draft" }))).toBe("ok");
	});

	it("deletes a form with its responses", async () => {
		const form = await makeForm(alice());
		await submit(form.slug);
		await forms.deleteForm(alice(), form.id);
		expect(await env.db.select().from(schema.formResponse)).toEqual([]);
	});
});

describe("Forms public page and submissions", () => {
	it("shows only a published form of an account", async () => {
		const published = await makeForm(alice());
		const draft = await makeForm(alice(), { draft: true });
		expect(await forms.getPublicForm(publicServices(), published.slug)).toEqual({
			slug: published.slug,
			title: "Café feedback",
			description: "A minute of your time",
			fields: FIELDS,
		});
		expect(await code(forms.getPublicForm(publicServices(), draft.slug))).toBe("NOT_FOUND");
		expect(await code(forms.getPublicForm(publicServices(), "nosuchform"))).toBe("NOT_FOUND");
		await forms.setFormStatus(alice(), { id: published.id, status: "draft" });
		expect(await code(forms.getPublicForm(publicServices(), published.slug))).toBe("NOT_FOUND");
	});

	it("never shows a guest's form, even one marked published", async () => {
		const form = await makeForm(guest(), { draft: true });
		await env.db.update(schema.form).set({ status: "published" });
		expect(await code(forms.getPublicForm(publicServices(), form.slug))).toBe("NOT_FOUND");
		expect(await code(submit(form.slug))).toBe("NOT_FOUND");
	});

	it("stores a valid response without its empty answers, and keeps no IP", async () => {
		const form = await makeForm(alice());
		expect(await submit(form.slug, { fname0001: "  Asha ", fstars001: 4, fdrink001: "" })).toEqual({ sent: true });
		const [row] = await env.db.select().from(schema.formResponse);
		expect(row).toMatchObject({
			formId: form.id,
			ownerId: "alice",
			data: { fname0001: "Asha", fstars001: 4 },
			ipHash: "hash-a",
		});
	});

	it("refuses answers that don't pass the form's schema, per field id", async () => {
		const form = await makeForm(alice());
		try {
			await submit(form.slug, { fname0001: "", fstars001: 7, fdrink001: "onope00" });
			throw new Error("accepted");
		} catch (error) {
			expect(isAppError(error) && error.code).toBe("BAD_REQUEST");
			expect(Object.keys((isAppError(error) && error.fieldErrors) || {}).sort()).toEqual([
				"fdrink001",
				"fname0001",
				"fstars001",
			]);
		}
		expect(await env.db.select().from(schema.formResponse)).toEqual([]);
	});

	it("asks to reload when the questions changed since the page loaded", async () => {
		const form = await makeForm(alice());
		const { fdrink001: _drink, ...withoutOne } = good;
		for (const answers of [{ ...good, fextra001: "added since" }, withoutOne]) {
			try {
				await submit(form.slug, answers);
				throw new Error("accepted");
			} catch (error) {
				expect(isAppError(error) && error.code).toBe("CONFLICT");
				expect(error instanceof Error && error.message).toBe("The form's questions changed");
			}
		}
		expect(await env.db.select().from(schema.formResponse)).toEqual([]);
	});

	it("pretends to take a filled honeypot and stores nothing", async () => {
		const form = await makeForm(alice());
		expect(await submit(form.slug, good, { website: "https://spam.example" })).toEqual({ sent: true });
		expect(await env.db.select().from(schema.formResponse)).toEqual([]);
	});

	it("refuses a failed Turnstile check", async () => {
		const form = await makeForm(alice());
		const refused = forms.submitResponse(
			publicServices(),
			{ slug: form.slug, answers: good, captcha: "bad" },
			{ ipHash: "hash-a", verifyCaptcha: async () => false },
		);
		expect(await code(refused)).toBe("BAD_REQUEST");
	});

	it("limits how often one sender answers one form", async () => {
		const form = await makeForm(alice());
		const other = await makeForm(alice());
		for (let index = 0; index < FORM_RESPONSE_LIMIT.max; index++) await submit(form.slug);
		expect(await code(submit(form.slug))).toBe("RATE_LIMITED");
		expect(await code(submit(form.slug, good, {}, "hash-b"))).toBe("ok");
		expect(await code(submit(other.slug))).toBe("ok");
	});

	it("stops taking responses once a form has its most", async () => {
		const form = await makeForm(alice());
		await env.db.insert(schema.formResponse).values(
			Array.from({ length: FORMS_QUOTAS.responsesPerForm }, () => ({
				formId: form.id,
				ownerId: "alice",
				data: { fname0001: "x", fstars001: 3 },
			})),
		);
		expect(await code(submit(form.slug))).toBe("CONFLICT");
	});
});

describe("Forms results", () => {
	it("summarizes every response and pages them, the newest first", async () => {
		const form = await makeForm(alice());
		for (const [index, stars] of [5, 3, 4].entries()) {
			await submit(
				form.slug,
				{ fname0001: `Person ${index}`, fstars001: stars, fdrink001: "otea000" },
				{},
				`ip-${index}`,
			);
		}
		const results = await forms.getResults(alice(), form.id, 1);
		expect(results.total).toBe(3);
		expect(results.results[1]).toMatchObject({ kind: "rating", average: 4, counts: [0, 0, 1, 1, 1] });
		expect(results.results[2]).toMatchObject({ kind: "choice", answered: 3 });
		expect(results.responses.map((response) => response.answers.fname0001)).toEqual([
			"Person 2",
			"Person 1",
			"Person 0",
		]);
		expect(results).toMatchObject({ page: 1, pageCount: 1 });
		// A page past the end shows the last one.
		expect((await forms.getResults(alice(), form.id, 9)).page).toBe(1);
		expect(await forms.exportResponses(alice(), form.id)).toHaveLength(3);
	});
});

describe("Forms guests and admin", () => {
	it("gives a new guest a sample survey with responses, in their language", async () => {
		await env.db.transaction((tx) => forms.seedForms(tx, "guest-1", "ne"));
		const { forms: list } = await forms.listForms(guest());
		expect(list).toEqual([expect.objectContaining({ title: "क्याफेबारे प्रतिक्रिया", status: "draft", responses: 12 })]);
		const results = await forms.getResults(guest(), list[0]?.id ?? "", 1);
		expect(results.results[0]).toMatchObject({ kind: "rating", answered: 12 });
		expect(results.results.some((result) => result.kind === "text" && result.latest.length > 0)).toBe(true);
	});

	it("hands a guest's forms and responses to the account that claims them", async () => {
		const form = await makeForm(guest(), { draft: true });
		await env.db
			.insert(schema.formResponse)
			.values({ formId: form.id, ownerId: "guest-1", data: { fname0001: "x", fstars001: 3 } });
		await env.db.transaction((tx) => forms.claimForms(tx, "guest-1", "alice"));
		expect((await forms.listForms(alice())).forms).toEqual([expect.objectContaining({ id: form.id, responses: 1 })]);
		expect((await forms.listForms(guest())).forms).toEqual([]);
		// Once an account's, it can be published and answered.
		await forms.setFormStatus(alice(), { id: form.id, status: "published" });
		expect(await code(submit(form.slug))).toBe("ok");
	});

	it("counts accounts, guests and rows for /admin/apps", async () => {
		await makeForm(alice());
		await makeForm(guest(), { draft: true });
		const usage = await forms.formsUsage(env.db);
		expect(usage).toEqual({ accounts: 1, guests: 1, rows: { forms: 2, published: 1, responses: 0 } });
	});
});
