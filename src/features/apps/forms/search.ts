import { z } from "zod";
import { pageParam } from "@/lib/list/params";

/** The public page's path: /f/<slug> (ten random letters and digits, made by the server). */
export const FORM_SLUG_PATTERN = /^[a-z0-9]{10}$/;

/** A form's builder and results: its id (a UUID), or no match at all. */
export const formParamsSchema = z.object({ formId: z.uuid() });

/** /f/$slug: a public form's slug, or no match at all. */
export const publicFormParamsSchema = z.object({ slug: z.string().regex(FORM_SLUG_PATTERN) });

/** The results page: which page of responses. */
export const formResultsSearchSchema = z.object({ page: pageParam(1000) });
