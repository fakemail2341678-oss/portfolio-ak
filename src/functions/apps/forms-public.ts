import { createServerFn } from "@tanstack/react-start";
import { formSlugInputSchema, submitResponseInputSchema } from "@/features/apps/forms/schema";
import type { PublicForm } from "@/features/apps/forms/types";
import { zodInput } from "@/functions/_lib/validator";
import { withPublic } from "@/middleware/services";
import * as forms from "@/server/apps/forms/service";
import { publicFormGuards } from "@/server/http/turnstile";

/**
 * A published form's public page (/f/$slug, decision 0195): anyone with the link, no
 * session. Only a published form of an account, by its random slug; a draft, a
 * guest's or an unknown slug is NOT_FOUND (the page's 404). Submissions pass a
 * honeypot, Turnstile when configured, a rate limit per sender and the form's own
 * schema.
 */
export const getPublicForm = createServerFn({ method: "GET" })
	.middleware([withPublic])
	.validator(zodInput(formSlugInputSchema))
	.handler(({ data, context }): Promise<PublicForm> => forms.getPublicForm(context, data.slug));

export const submitFormResponse = createServerFn({ method: "POST" })
	.middleware([withPublic])
	.validator(zodInput(submitResponseInputSchema))
	.handler(({ data, context }): Promise<{ sent: true }> => forms.submitResponse(context, data, publicFormGuards()));
