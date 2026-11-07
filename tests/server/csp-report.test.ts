import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type CspViolation,
	createReportLimiter,
	handleCspReport,
	parseCspReports,
	reportCspViolation,
	stripUrl,
} from "@/server/http/csp-report";

const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@sentry/tanstackstart-react", () => ({ captureMessage }));

beforeEach(() => captureMessage.mockClear());

const REPORTING_API = JSON.stringify([
	{
		type: "csp-violation",
		age: 10,
		url: "https://app.example/admin?token=secret",
		user_agent: "Chrome",
		body: {
			documentURL: "https://app.example/admin?token=secret",
			blockedURL: "https://evil.example/x.js?id=1",
			effectiveDirective: "script-src-elem",
			disposition: "enforce",
			sourceFile: "https://app.example/assets/index.js",
			lineNumber: 12,
			columnNumber: 3,
			sample: "",
		},
	},
	{ type: "deprecation", body: { id: "x" } },
]);

const LEGACY = JSON.stringify({
	"csp-report": {
		"document-uri": "https://app.example/test-crud#top",
		"violated-directive": "img-src https:",
		"blocked-uri": "data",
		"line-number": 4,
	},
});

const post = (body: string, contentType: string) =>
	new Request("https://app.example/api/csp-report", {
		method: "POST",
		headers: { "content-type": contentType },
		body,
	});

describe("parseCspReports", () => {
	it("reads Reporting API batches, keeping only csp-violation entries", () => {
		expect(parseCspReports("application/reports+json", REPORTING_API)).toEqual([
			{
				directive: "script-src-elem",
				blocked: "https://evil.example/x.js",
				document: "https://app.example/admin",
				source: "https://app.example/assets/index.js",
				line: 12,
				column: 3,
				disposition: "enforce",
			},
		]);
	});

	it("reads report-uri reports, using the directive name only", () => {
		expect(parseCspReports("application/csp-report", LEGACY)).toEqual([
			{
				directive: "img-src",
				blocked: "data",
				document: "https://app.example/test-crud",
				line: 4,
				disposition: "enforce",
			},
		]);
	});

	it("drops violations caused by browser extensions", () => {
		const body = JSON.stringify({
			"csp-report": {
				"document-uri": "https://app.example/",
				"effective-directive": "script-src",
				"blocked-uri": "chrome-extension",
				"source-file": "chrome-extension://abc/content.js",
			},
		});
		expect(parseCspReports("application/csp-report", body)).toEqual([]);
	});

	it("returns null for bodies that aren't JSON and nothing for unknown shapes", () => {
		expect(parseCspReports("application/csp-report", "<xml/>")).toBeNull();
		expect(parseCspReports("application/json", JSON.stringify({ hello: "world" }))).toEqual([]);
	});
});

describe("stripUrl", () => {
	it("keeps origin and path, never the query or hash", () => {
		expect(stripUrl("https://a.example/p/q?x=1#h")).toBe("https://a.example/p/q");
		expect(stripUrl("inline")).toBe("inline");
		expect(stripUrl("blob:https://a.example/123")).toBe("blob:");
	});
});

describe("createReportLimiter", () => {
	it("caps each client and the total per window, then starts over", () => {
		let now = 0;
		const limiter = createReportLimiter({ perClient: 3, total: 5, windowMs: 1000, now: () => now });
		expect(limiter.take("a", 2)).toBe(2);
		expect(limiter.take("a", 2)).toBe(1);
		expect(limiter.take("b", 4)).toBe(2);
		expect(limiter.take("c", 1)).toBe(0);
		now = 1000;
		expect(limiter.take("c", 1)).toBe(1);
	});
});

describe("handleCspReport", () => {
	const setup = (perClient = 10) => {
		const reported: CspViolation[] = [];
		const options = {
			client: "203.0.113.9",
			limiter: createReportLimiter({ perClient, total: 100 }),
			report: (violation: CspViolation) => reported.push(violation),
		};
		return { reported, options };
	};

	it("accepts both report formats with 204 and reports each violation", async () => {
		const { reported, options } = setup();
		expect((await handleCspReport(post(REPORTING_API, "application/reports+json"), options)).status).toBe(204);
		expect((await handleCspReport(post(LEGACY, "application/csp-report"), options)).status).toBe(204);
		expect(reported.map((violation) => violation.directive)).toEqual(["script-src-elem", "img-src"]);
	});

	it("answers 429 once the client's budget is spent, reporting nothing more", async () => {
		const { reported, options } = setup(1);
		expect((await handleCspReport(post(LEGACY, "application/csp-report"), options)).status).toBe(204);
		expect((await handleCspReport(post(LEGACY, "application/csp-report"), options)).status).toBe(429);
		expect(reported).toHaveLength(1);
	});

	it("refuses other content types, bodies that aren't JSON and oversized bodies", async () => {
		const { reported, options } = setup();
		expect((await handleCspReport(post(LEGACY, "text/plain"), options)).status).toBe(415);
		expect((await handleCspReport(post("nope", "application/csp-report"), options)).status).toBe(400);
		const huge = post(JSON.stringify({ "csp-report": { pad: "x".repeat(70_000) } }), "application/csp-report");
		expect((await handleCspReport(huge, options)).status).toBe(413);
		expect(reported).toEqual([]);
	});
});

describe("reportCspViolation", () => {
	it("sends a warning to Sentry, grouped by directive and blocked resource", () => {
		reportCspViolation({
			directive: "img-src",
			blocked: "https://evil.example/x.png",
			document: "https://app.example/",
			disposition: "enforce",
		});
		expect(captureMessage).toHaveBeenCalledWith(
			"CSP violation: img-src blocked https://evil.example/x.png",
			expect.objectContaining({
				level: "warning",
				fingerprint: ["csp-violation", "img-src", "https://evil.example/x.png"],
				tags: { "csp.directive": "img-src", "csp.disposition": "enforce" },
			}),
		);
	});
});
