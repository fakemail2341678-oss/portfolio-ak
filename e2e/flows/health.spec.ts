/** GET /api/health for uptime monitors, and the request id every response carries. */
import { expect, test } from "../support/fixtures.ts";

test("the health endpoint answers 200 JSON with the database latency, never cached", async ({ request }) => {
	const response = await request.get("/api/health");
	expect(response.status()).toBe(200);
	expect(response.headers()["content-type"]).toMatch(/^application\/json/);
	expect(response.headers()["cache-control"]).toBe("no-store");
	const body = await response.json();
	expect(body).toMatchObject({ status: "ok", checks: { database: { status: "ok" } } });
	expect(typeof body.checks.database.latencyMs).toBe("number");
	expect((await request.head("/api/health")).status()).toBe(200);
});

test("every response has its own request id", async ({ request }) => {
	const ids = await Promise.all(
		["/", "/api/health", "/no-such-page"].map(async (path) => (await request.get(path)).headers()["x-request-id"]),
	);
	for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
	expect(new Set(ids).size).toBe(ids.length);
});

test("a path with malformed percent-encoding is a quick 400, not a hung request", async ({ request }) => {
	// Nitro's h3 before 2.0.8 threw an uncaught URIError on these and never answered (Task 45 follow-up).
	for (const path of ["/work/%E0", "/l/%E0"]) {
		const response = await request.get(path, { timeout: 5000, maxRedirects: 0 });
		expect(response.status(), path).toBe(400);
	}
	expect((await request.get("/api/health")).status()).toBe(200);
});
