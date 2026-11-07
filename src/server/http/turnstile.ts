import "@tanstack/react-start/server-only";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Checks a Turnstile token for a form of your own (Better Auth's captcha plugin
 * covers the auth endpoints, decision 0128). Tokens are single-use and expire
 * after five minutes. Recipe: docs/guides/recipes.md, "Contact form".
 */
export async function verifyTurnstile(
	secret: string,
	token: string | undefined,
	ip: string | undefined,
	fetcher: typeof fetch = fetch,
): Promise<boolean> {
	if (!token) return false;
	const body = new URLSearchParams({ secret, response: token });
	if (ip) body.set("remoteip", ip);
	try {
		const response = await fetcher(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(5000) });
		const result = (await response.json()) as { success?: unknown };
		return result.success === true;
	} catch {
		// Cloudflare unreachable: refuse rather than let the form through unchecked.
		return false;
	}
}
