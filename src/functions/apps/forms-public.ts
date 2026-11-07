import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { formSlugInput, submitResponseInput } from "@/features/apps/forms/schema";
import type { PublicForm } from "@/features/apps/forms/types";
import { zodInput } from "@/functions/_lib/validator";
import { withPublicServices } from "@/middleware/services";
import * as forms from "@/server/apps/forms/service";
import { clientIpHash, trustedClientIp } from "@/server/auth/client-ip";
import { serverEnv } from "@/server/env";
import { verifyTurnstile } from "@/server/http/turnstile";

/**
 * A published form's public page (/f/$slug, decision 0195): anyone with the link, no
 * session. Only a published form of an account, by its random slug; a draft, a
 * guest's or an unknown slug is NOT_FOUND (the page's 404). Submissions pass a
 * honeypot, Turnstile when configured, a rate limit per sender and the form's own
 * schema.
 */
export const getPublicForm = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(formSlugInput))
	.handler(({ data, context }): Promise<PublicForm> => forms.getPublicForm(context, data.slug));

export const submitFormResponse = createServerFn({ method: "POST" })
	.middleware([withPublicServices])
	.validator(zodInput(submitResponseInput))
	.handler(({ data, context }): Promise<{ sent: true }> => {
		const ip = trustedClientIp(getRequest());
		const secret = serverEnv.TURNSTILE_SECRET_KEY;
		return forms.submitResponse(context, data, {
			ipHash: clientIpHash(ip),
			verifyCaptcha: secret ? (token) => verifyTurnstile(secret, token, ip) : null,
		});
	});
