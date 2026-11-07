import type { Answers, FormField } from "./fields";

/** Forms' limits (decision 0195): per user, per form, and per sender of responses. */
export const FORMS_QUOTAS = { forms: 20, responsesPerForm: 1000 } as const;

/** Responses one sender (a keyed hash of their IP) may send one form in an hour. */
export const FORM_RESPONSE_LIMIT = { max: 5, windowSeconds: 3600 } as const;

/** Rows of the results page's response table. */
export const RESPONSES_PAGE_SIZE = 25;

/** Text answers each text field shows on the results page (the newest first). */
export const LATEST_ANSWERS = 5;

export const FORM_STATUSES = ["draft", "published"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

/** A form in the user's list. */
export type FormSummary = {
	id: string;
	slug: string;
	title: string;
	status: FormStatus;
	fieldCount: number;
	responses: number;
	updatedAt: string;
};

/** The list page: the user's forms, and the server's time (relative times print the same on both renders). */
export type FormsList = { forms: FormSummary[]; now: string };

/** The builder's form: its definition, the version it was read at, and how many responses it has. */
export type FormDetail = {
	id: string;
	slug: string;
	title: string;
	description: string;
	fields: FormField[];
	status: FormStatus;
	responses: number;
	/** `updatedAt` as ISO: the version a save starts from. */
	updatedAt: string;
};

/** What a respondent sees at /f/$slug. */
export type PublicForm = { slug: string; title: string; description: string; fields: FormField[] };

/** One field's results (computed from every response). */
export type FieldResult =
	| { kind: "choice"; fieldId: string; answered: number; counts: Array<{ optionId: string; count: number }> }
	| { kind: "rating"; fieldId: string; answered: number; average: number | null; counts: number[] }
	| {
			kind: "number";
			fieldId: string;
			answered: number;
			average: number | null;
			min: number | null;
			max: number | null;
	  }
	| { kind: "consent"; fieldId: string; answered: number; agreed: number }
	| { kind: "text"; fieldId: string; answered: number; latest: string[] };

export type FormResponse = { id: string; submittedAt: string; answers: Answers };

export type FormResults = {
	form: Pick<FormDetail, "id" | "slug" | "title" | "status" | "fields">;
	total: number;
	results: FieldResult[];
	/** One page of responses, the newest first. */
	responses: FormResponse[];
	page: number;
	pageCount: number;
};
