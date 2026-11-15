import { m } from "@/paraglide/messages";

/**
 * Bot checks for the public auth forms (decisions.md 0128).
 *
 * - A honeypot: a field people never see or reach. Form-filling bots fill it, and
 *   the form then pretends to succeed without calling the server.
 * - Cloudflare Turnstile, when the server has a site key: the widget's token goes
 *   to Better Auth in the `x-captcha-response` header, and its captcha plugin
 *   verifies it on register, forgot-password and sign-in-code.
 */

const HONEYPOT_NAME = "website";

/** Visually hidden, out of the tab order and hidden from assistive tech, so only bots fill it. */
export function Honeypot() {
	return (
		<div aria-hidden="true" className="sr-only">
			<label>
				{m.auth_honeypot_label()}
				<input type="text" name={HONEYPOT_NAME} tabIndex={-1} autoComplete="off" defaultValue="" />
			</label>
		</div>
	);
}

/** True when the honeypot was filled in: treat the submit as a bot's. */
export const isBot = (form: FormData) => {
	const value = form.get(HONEYPOT_NAME);
	return typeof value === "string" && value.length > 0;
};

/** Turnstile's header for a Better Auth client call (`fetchOptions`), or nothing without a token. */
export const captchaFetchOptions = (token: string | undefined) =>
	token ? { fetchOptions: { headers: { "x-captcha-response": token } } } : {};
