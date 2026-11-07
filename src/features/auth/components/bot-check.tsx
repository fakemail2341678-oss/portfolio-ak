import { useEffect, useRef, useState } from "react";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

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

type TurnstileApi = {
	render: (element: HTMLElement, options: Record<string, unknown>) => string;
	reset: (widgetId: string) => void;
	remove: (widgetId: string) => void;
};
declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoading: Promise<TurnstileApi> | undefined;

/** Loads Turnstile's script once. A script our own (nonced) code adds is allowed by the CSP's 'strict-dynamic'. */
const loadTurnstile = () => {
	scriptLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing")));
		script.onerror = () => {
			scriptLoading = undefined;
			reject(new Error("Turnstile failed to load"));
		};
		document.head.append(script);
	});
	return scriptLoading;
};

/** Turnstile's header for a Better Auth client call (`fetchOptions`), or nothing without a token. */
export const captchaFetchOptions = (token: string | undefined) =>
	token ? { fetchOptions: { headers: { "x-captcha-response": token } } } : {};

/**
 * The Turnstile widget for one form. Without a site key it renders nothing and
 * `ready` is always true. Tokens are single-use: call `reset()` after each submit.
 */
export function useTurnstile(siteKey: string | null) {
	const container = useRef<HTMLDivElement>(null);
	const widget = useRef<string | undefined>(undefined);
	const [token, setToken] = useState<string>();

	useEffect(() => {
		if (!siteKey) return;
		let cancelled = false;
		loadTurnstile()
			.then((api) => {
				if (cancelled || !container.current) return;
				widget.current = api.render(container.current, {
					sitekey: siteKey,
					language: getLocale(),
					theme: "auto",
					size: "flexible",
					callback: (value: string) => setToken(value),
					"expired-callback": () => setToken(undefined),
					"error-callback": () => setToken(undefined),
				});
			})
			.catch(() => setToken(undefined));
		return () => {
			cancelled = true;
			if (widget.current) window.turnstile?.remove(widget.current);
			widget.current = undefined;
		};
	}, [siteKey]);

	const reset = () => {
		setToken(undefined);
		if (widget.current) window.turnstile?.reset(widget.current);
	};

	// The widget is 65 px tall; the space is kept from the first paint so it doesn't shift the form.
	const element = siteKey ? <div ref={container} className="min-h-[65px]" data-testid="turnstile" /> : null;

	return { element, token, ready: !siteKey || Boolean(token), reset };
}
