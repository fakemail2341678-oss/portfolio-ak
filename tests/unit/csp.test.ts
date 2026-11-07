import { describe, expect, it } from "vitest";
import { buildCsp, CSP_REPORT_GROUP, originOf, reportingEndpoints, STATIC_SECURITY_HEADERS } from "@/lib/http/csp";

const directives = (policy: string) =>
	Object.fromEntries(
		policy.split("; ").map((part) => {
			const [name = "", ...values] = part.split(" ");
			return [name, values];
		}),
	);

describe("buildCsp", () => {
	it("allows only nonce-bearing scripts (and what they load), never eval or inline handlers", () => {
		const csp = directives(buildCsp({ nonce: "abc123" }));
		expect(csp["script-src"]).toEqual(["'nonce-abc123'", "'strict-dynamic'"]);
		expect(csp["script-src"]).not.toContain("'unsafe-eval'");
		expect(csp["script-src"]).not.toContain("'unsafe-inline'");
		expect(csp["object-src"]).toEqual(["'none'"]);
		expect(csp["frame-ancestors"]).toEqual(["'none'"]);
		expect(csp["base-uri"]).toEqual(["'self'"]);
		expect(csp["form-action"]).toEqual(["'self'"]);
	});

	it("limits network access to the same origin plus the configured services", () => {
		expect(directives(buildCsp({ nonce: "n" }))["connect-src"]).toEqual(["'self'"]);
		const csp = directives(
			buildCsp({ nonce: "n", connectOrigins: ["https://o1.ingest.sentry.io", "https://eu.i.posthog.com"] }),
		);
		expect(csp["connect-src"]).toEqual(["'self'", "https://o1.ingest.sentry.io", "https://eu.i.posthog.com"]);
	});

	it("allows images from the same origin (plus data/blob previews) and configured hosts only", () => {
		expect(directives(buildCsp({ nonce: "n" }))["img-src"]).toEqual(["'self'", "data:", "blob:"]);
		const csp = directives(buildCsp({ nonce: "n", imgOrigins: ["https://res.cloudinary.com"] }));
		expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:", "https://res.cloudinary.com"]);
	});

	it("allows no frames, unless a captcha's challenge origin is configured", () => {
		expect(directives(buildCsp({ nonce: "n" }))["frame-src"]).toBeUndefined();
		const csp = directives(buildCsp({ nonce: "n", frameOrigins: ["https://challenges.cloudflare.com"] }));
		expect(csp["frame-src"]).toEqual(["https://challenges.cloudflare.com"]);
		expect(csp["script-src"]).toEqual(["'nonce-n'", "'strict-dynamic'", "https://challenges.cloudflare.com"]);
		expect(csp["frame-ancestors"]).toEqual(["'none'"]);
	});

	it("reports violations only when given a report URL, with report-to and report-uri", () => {
		expect(buildCsp({ nonce: "n" })).not.toMatch(/report-(?:to|uri)/);
		const csp = directives(buildCsp({ nonce: "n", reportUrl: "https://app.example/api/csp-report" }));
		expect(csp["report-uri"]).toEqual(["https://app.example/api/csp-report"]);
		expect(csp["report-to"]).toEqual([CSP_REPORT_GROUP]);
		expect(reportingEndpoints("https://app.example/api/csp-report")).toBe(
			`${CSP_REPORT_GROUP}="https://app.example/api/csp-report"`,
		);
	});

	it("upgrades insecure requests only when asked (production)", () => {
		expect(buildCsp({ nonce: "n" })).not.toContain("upgrade-insecure-requests");
		expect(buildCsp({ nonce: "n", upgradeInsecureRequests: true })).toMatch(/; upgrade-insecure-requests$/);
	});
});

describe("originOf", () => {
	it("reduces a DSN or host URL to its origin, and ignores junk", () => {
		expect(originOf("https://key@o123.ingest.sentry.io/4504")).toBe("https://o123.ingest.sentry.io");
		expect(originOf("https://us.i.posthog.com")).toBe("https://us.i.posthog.com");
		expect(originOf("not a url")).toBeNull();
		expect(originOf(undefined)).toBeNull();
	});
});

describe("static security headers", () => {
	it("include HSTS, nosniff, referrer and permissions policies, and frame protection", () => {
		expect(STATIC_SECURITY_HEADERS).toMatchObject({
			"strict-transport-security": expect.stringContaining("max-age=63072000"),
			"x-content-type-options": "nosniff",
			"referrer-policy": "strict-origin-when-cross-origin",
			"permissions-policy": expect.stringContaining("camera=()"),
			"x-frame-options": "DENY",
		});
	});
});
