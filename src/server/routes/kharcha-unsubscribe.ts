/**
 * /api/kharcha/unsubscribe (decision 0286): the link in Kharcha's emails to people without
 * an account (an invite, a reminder). `?p=<person>&t=<token>&l=<locale>`; the token is an
 * HMAC of the person (src/server/kharcha/notify/contact-mail.ts).
 *
 * - **POST** stops every email to them: the mail app's one click (`List-Unsubscribe-Post`,
 *   RFC 8058), or the button on the page. Idempotent.
 * - **GET** is the page the link opens: it asks first, so a link scanner opening it stops
 *   nothing. A plain page of its own, with no script: Kharcha's pages need a session.
 */
import { defineHandler } from "nitro";
import { KHARCHA_NAME } from "../../features/kharcha/brand";
import { m } from "../../paraglide/messages.js";
import { baseLocale, isLocale, type Locale } from "../../paraglide/runtime.js";
import { db } from "../db/client";
import { unsubscribe, validUnsubscribe } from "../kharcha/notify/contact-mail";
import { log } from "../log";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const page = (status: number, locale: Locale, heading: string, body: string, form = "") =>
	new Response(
		`<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(`${heading} · ${KHARCHA_NAME}`)}</title>
<style>
:root { color-scheme: light dark; }
body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px; font: 16px/1.5 system-ui, sans-serif; background: #f6efe2; color: #2a211b; }
main { max-width: 28rem; border-top: 6px solid #9b1c1c; background: #fffaf1; padding: 24px; box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); }
h1 { margin: 0 0 8px; font-size: 1.375rem; }
p { margin: 0 0 16px; }
button { font: inherit; font-weight: 600; color: #fff; background: #9b1c1c; border: 0; border-radius: 6px; padding: 10px 16px; cursor: pointer; }
button:focus-visible { outline: 3px solid #e0a526; outline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  body { background: #1d1815; color: #efe6d8; }
  main { background: #29221d; }
  button { background: #c23b2a; }
}
</style>
</head>
<body><main><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body)}</p>${form}</main></body>
</html>`,
		{
			status,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"content-security-policy":
					"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
			},
		},
	);

export default defineHandler(async (event) => {
	const url = new URL(event.req.url);
	const personId = url.searchParams.get("p") ?? "";
	const token = url.searchParams.get("t") ?? "";
	const asked = url.searchParams.get("l") ?? "";
	const locale: Locale = isLocale(asked) ? asked : baseLocale;
	const valid = UUID.test(personId) && validUnsubscribe(personId, token);
	if (!valid) {
		return page(
			400,
			locale,
			m.kharcha_unsubscribe_invalid_heading({}, { locale }),
			m.kharcha_unsubscribe_invalid_body({}, { locale }),
		);
	}
	if (event.req.method === "POST") {
		const done = await unsubscribe(db, personId);
		log("info", "kharcha unsubscribe", { done });
		return page(
			200,
			locale,
			m.kharcha_unsubscribe_done_heading({}, { locale }),
			m.kharcha_unsubscribe_done_body({ site: KHARCHA_NAME }, { locale }),
		);
	}
	const action = escapeHtml(`${url.pathname}${url.search}`);
	return page(
		200,
		locale,
		m.kharcha_unsubscribe_heading({ site: KHARCHA_NAME }, { locale }),
		m.kharcha_unsubscribe_body({ site: KHARCHA_NAME }, { locale }),
		`<form method="post" action="${action}"><button type="submit">${escapeHtml(m.kharcha_unsubscribe_button({}, { locale }))}</button></form>`,
	);
});
