import "@tanstack/react-start/server-only";
import { createHmac } from "node:crypto";
import { getRequestIP } from "@tanstack/react-start/server";
import { serverEnv } from "@/server/env";

/** The only header Better Auth trusts for the client IP (advanced.ipAddress in auth.ts). */
export const CLIENT_IP_HEADER = "x-client-ip";

/**
 * Rate limiting needs a client IP it can trust. A raw request has none, and
 * trusting a client-supplied X-Forwarded-For would let attackers spoof their way
 * around the limits, or share one bucket and lock everyone out.
 *
 * - On Vercel, x-vercel-forwarded-for / x-real-ip are set by Vercel's edge and
 *   can't be forged by the client.
 * - Self-hosted, the TCP socket address is used (put a reverse proxy's trusted
 *   header here instead if you deploy behind one).
 */
export const trustedClientIp = (request: Request): string | undefined => {
	if (process.env.VERCEL) {
		const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
		return forwarded?.split(",")[0]?.trim() || undefined;
	}
	return getRequestIP() ?? undefined;
};

/** Copy of the request whose CLIENT_IP_HEADER is set by us, never by the client. */
export const withTrustedClientIp = (request: Request): Request => {
	const headers = new Headers(request.headers);
	headers.delete(CLIENT_IP_HEADER);
	const ip = trustedClientIp(request);
	if (ip) headers.set(CLIENT_IP_HEADER, ip);
	// Rebuilt from parts: the server runtime's Request subclass (srvx) can't be
	// passed to the Request constructor directly.
	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	return new Request(request.url, {
		method: request.method,
		headers,
		signal: request.signal,
		...(hasBody ? { body: request.body, duplex: "half" } : {}),
	});
};

/**
 * A keyed hash of a client IP, for rate limits on public forms (the contact form, a
 * published Forms survey): stored instead of the IP, and keyed, so it can't be
 * reversed by hashing every IPv4 address. Null when the IP is unknown.
 *
 * Core, for any public form: a project stripped of both demo layers has no caller
 * yet, so knip is told the export is kept on purpose (Task 45).
 *
 * @public
 */
export const clientIpHash = (ip: string | undefined): string | null =>
	ip ? createHmac("sha256", serverEnv.BETTER_AUTH_SECRET).update(ip).digest("hex").slice(0, 32) : null;
